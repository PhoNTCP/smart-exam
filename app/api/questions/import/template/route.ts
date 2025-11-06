import { NextResponse } from "next/server";
import { utils, write } from "xlsx";

const TEMPLATE_ROWS = [
  [
    "subject",
    "gradeLevel",
    "body",
    "explanation",
    "choiceA",
    "choiceB",
    "choiceC",
    "choiceD",
    "correctChoice",
  ],
  [
    "Mathematics",
    "M3",
    "อธิบายหลักการหาพื้นที่สามเหลี่ยม",
    "ใช้สูตร 1/2 x ฐาน x สูง ในการหาพื้นที่",
    "ใช้สูตร 1/2 x ฐาน x สูง",
    "ใช้สูตร ฐาน x สูง",
    "ใช้สูตร 1/3 x ฐาน x สูง",
    "ใช้สูตร 2 x ฐาน x สูง",
    "A",
  ],
];

export async function GET() {
  const workbook = utils.book_new();
  const sheet = utils.aoa_to_sheet(TEMPLATE_ROWS);
  sheet["!cols"] = [
    { wch: 20 }, // subject
    { wch: 10 }, // gradeLevel
    { wch: 50 }, // body
    { wch: 60 }, // explanation
    { wch: 20 }, // choiceA
    { wch: 20 }, // choiceB
    { wch: 20 }, // choiceC
    { wch: 20 }, // choiceD
    { wch: 12 }, // correctChoice
  ];
  utils.book_append_sheet(workbook, sheet, "Questions");

  const buffer = write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="question-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
