import { Prisma, PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

// Helper to create decimal values with fixed precision
const decimal = (value: number) => new Prisma.Decimal(value.toFixed(2));

async function main() {
  console.log("🌱 Seeding database...");

  // Clean tables so the seed is idempotent
  await prisma.attemptAnswer.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.aiScore.deleteMany();
  await prisma.choice.deleteMany();
  await prisma.question.deleteMany();
  await prisma.user.deleteMany();

  // Create primary teacher and students
  const teacherPassword = await hash("teacher123", 10);
  const studentPassword = await hash("student123", 10);

  const teacher = await prisma.user.create({
    data: {
      name: "Aj. Supaporn",
      email: "teacher@smart-exam.dev",
      passwordHash: teacherPassword,
      role: "teacher",
    },
  });

  const students = await Promise.all(
    ["student1@smart-exam.dev", "student2@smart-exam.dev", "student3@smart-exam.dev"].map((email, index) =>
      prisma.user.create({
        data: {
          name: `Student ${index + 1}`,
          email,
          passwordHash: studentPassword,
          role: "student",
        },
      }),
    ),
  );

  // Generate 30 questions covering multiple subjects and grades
  const subjects = ["Mathematics", "Science", "English", "Computer", "History", "Geography"];
  const grades = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11"];
  const modelNames = ["gpt-4.1-mini", "gpt-4.1", "gemini-2.0", "claude-3.5"];

  const questionRecords = [];

  for (let index = 0; index < 30; index += 1) {
    const subject = subjects[index % subjects.length];
    const gradeLevel = grades[index % grades.length];
    const difficulty = (index % 5) + 1;
    const modelName = modelNames[index % modelNames.length];
    const correctChoiceIndex = index % 4;

    const question = await prisma.question.create({
      data: {
        subject,
        gradeLevel,
        body: `ข้อที่ ${index + 1}: อธิบายแนวคิดหัวข้อ "${subject}" สำหรับระดับ ${gradeLevel}.`,
        explanation: "เฉลยนี้ช่วยให้นักเรียนเห็นขั้นตอนการคิดแบบเป็นระบบ.",
        createdById: teacher.id,
        shouldRescore: false,
        choices: {
          create: Array.from({ length: 4 }).map((_, choiceIndex) => ({
            text: `คำตอบตัวเลือกที่ ${choiceIndex + 1} สำหรับข้อที่ ${index + 1}`,
            isCorrect: choiceIndex === correctChoiceIndex,
            order: choiceIndex,
          })),
        },
        aiScores: {
          create: {
            difficulty,
            reason: `โมเดลประเมินว่าข้อนี้มีระดับความยาก ${difficulty} เนื่องจากรูปแบบการคิดที่ต้องใช้.`,
            modelName,
          },
        },
      },
      include: {
        choices: true,
      },
    });

    questionRecords.push(question);
  }

  // Create sample exams
  await prisma.exam.createMany({
    data: [
      {
        title: "Mathematics Midterm",
        subject: "Mathematics",
        isAdaptive: false,
        createdById: teacher.id,
      },
      {
        title: "Science Adaptive Assessment",
        subject: "Science",
        isAdaptive: true,
        createdById: teacher.id,
      },
    ],
  });

  const mathExam = await prisma.exam.findFirstOrThrow({
    where: { title: "Mathematics Midterm" },
  });
  const scienceExam = await prisma.exam.findFirstOrThrow({
    where: { title: "Science Adaptive Assessment" },
  });

  // Attach attempts for each student using the first few questions
  for (const [studentIndex, student] of students.entries()) {
    const exam = studentIndex % 2 === 0 ? mathExam : scienceExam;
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        userId: student.id,
        thetaStart: decimal(0.2 + studentIndex * 0.1),
        thetaEnd: decimal(0.4 + studentIndex * 0.15),
        score: 65 + studentIndex * 5,
        finishedAt: new Date(),
      },
    });

    const sampledQuestions = questionRecords.slice(studentIndex * 3, studentIndex * 3 + 3);
    for (const [answerIndex, question] of sampledQuestions.entries()) {
      const selectedChoice = question.choices[answerIndex % question.choices.length];
      await prisma.attemptAnswer.create({
        data: {
          attemptId: attempt.id,
          questionId: question.id,
          choiceId: selectedChoice.id,
          isCorrect: selectedChoice.isCorrect,
          thetaBefore: decimal(0.2 + answerIndex * 0.05),
          thetaAfter: decimal(0.25 + answerIndex * 0.07),
          pickedAt: new Date(Date.now() - answerIndex * 60 * 1000),
        },
      });
    }
  }

  console.log("✅ Seeding completed successfully!");
}

main()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
