import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean tables so the seed is idempotent
  await prisma.attemptAnswer.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.aiScore.deleteMany();
  await prisma.choice.deleteMany();
  await prisma.question.deleteMany();
  await prisma.studentExam.deleteMany();
  await prisma.examAssignment.deleteMany();
  await prisma.subjectEnrollment.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.user.deleteMany();

  // Create primary teacher and a few students
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

  console.log(`👩‍🏫 Teacher account ready: ${teacher.email} / teacher123`);
  students.forEach((student, index) => {
    console.log(`👩‍🎓 Student ${index + 1}: ${student.email} / student123`);
  });

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
