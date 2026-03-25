"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type AttemptRow = {
  attemptId: string;
  studentId: string;
  studentName?: string;
  studentEmail: string;
  subject: string;
  subjectCode?: string;
  examTitle: string;
  score: number;
  answerCount: number;
  startedAt: string;
  finishedAt: string | null;
};

type TeacherReportsDashboardProps = {
  data: {
    attempts: AttemptRow[];
    subjects: string[];
  };
};

const buildCsv = (rows: Array<Record<string, string | number>>) => {
  if (rows.length === 0) {
    return "No data";
  }
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === undefined || value === null) return "";
          const stringValue = String(value).replace(/"/g, '""');
          return `"${stringValue}"`;
        })
        .join(","),
    ),
  ];
  return csvRows.join("\r\n");
};

export const TeacherReportsDashboard = ({ data }: TeacherReportsDashboardProps) => {
  const [subject, setSubject] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [query, setQuery] = useState<string>("");

  const filteredAttempts = useMemo(() => {
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999Z`) : null;

    return data.attempts.filter((attempt) => {
      if (subject !== "all" && attempt.subject !== subject) {
        return false;
      }

      const startedAt = new Date(attempt.startedAt);
      if (from && startedAt < from) {
        return false;
      }
      if (to && startedAt > to) {
        return false;
      }

      if (query) {
        const term = query.toLowerCase();
        const haystack = [
          attempt.studentName ?? "",
          attempt.studentEmail,
          attempt.examTitle,
          attempt.subject,
          attempt.subjectCode ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [data.attempts, subject, fromDate, toDate, query]);

  const stats = useMemo(() => {
    if (filteredAttempts.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
      };
    }

    const totalAttempts = filteredAttempts.length;
    const totalScore = filteredAttempts.reduce((sum, attempt) => sum + attempt.score, 0);

    return {
      totalAttempts,
      averageScore: totalScore / totalAttempts,
    };
  }, [filteredAttempts]);

  const groupedByStudent = useMemo(() => {
    const map = new Map<
      string,
      {
        studentId: string;
        studentName?: string;
        studentEmail: string;
        attempts: number;
        totalScore: number;
        lastAttemptAt: string;
      }
    >();

    filteredAttempts.forEach((attempt) => {
      const existing = map.get(attempt.studentId);
      if (!existing) {
        map.set(attempt.studentId, {
          studentId: attempt.studentId,
          studentName: attempt.studentName,
          studentEmail: attempt.studentEmail,
          attempts: 1,
          totalScore: attempt.score,
          lastAttemptAt: attempt.startedAt,
        });
      } else {
        existing.attempts += 1;
        existing.totalScore += attempt.score;
        if (new Date(attempt.startedAt) > new Date(existing.lastAttemptAt)) {
          existing.lastAttemptAt = attempt.startedAt;
        }
      }
    });

    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        averageScore: entry.totalScore / entry.attempts,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);
  }, [filteredAttempts]);

  const exportRows = groupedByStudent.map((row) => ({
    Student: row.studentName ?? row.studentEmail,
    Email: row.studentEmail,
    Attempts: row.attempts,
    "Average Score": row.averageScore.toFixed(2),
    "Last Attempt": new Date(row.lastAttemptAt).toLocaleString(),
  }));

  const handleExport = (extension: "csv" | "xls") => {
    const csv = buildCsv(exportRows);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `teacher-report.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">รายงานภาพรวม</h1>
        <p className="text-sm text-muted-foreground">
          ใช้ฟิลเตอร์เพื่อดูภาพรวมผลการทำข้อสอบของนักเรียนตามวิชา ช่วงเวลา หรือคำค้นหา
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>จำนวน Attempt</CardTitle>
            <CardDescription>ตามเงื่อนไขที่เลือก</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{stats.totalAttempts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>คะแนนเฉลี่ย</CardTitle>
            <CardDescription>เฉลี่ยทุก Attempt</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{stats.averageScore.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ฟิลเตอร์</CardTitle>
          <CardDescription>เลือกวิชา / ช่วงเวลา / คำค้นหา</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Input
            placeholder="ค้นหาชื่อ/อีเมล/ข้อสอบ"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="md:col-span-2"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          >
            <option value="all">ทุกวิชา</option>
            {data.subjects.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => handleExport("csv")} disabled={groupedByStudent.length === 0}>
          Export CSV
        </Button>
        <Button variant="outline" onClick={() => handleExport("xls")} disabled={groupedByStudent.length === 0}>
          Export Excel
        </Button>
        <Badge variant="secondary">นักเรียนที่พบ {groupedByStudent.length} คน</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ภาพรวมตามนักเรียน</CardTitle>
          <CardDescription>รวม Attempt, คะแนนเฉลี่ย และ Attempt ล่าสุด</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">นักเรียน</th>
                <th className="px-3 py-2 font-medium">อีเมล</th>
                <th className="px-3 py-2 font-medium">จำนวน Attempt</th>
                <th className="px-3 py-2 font-medium">คะแนนเฉลี่ย</th>
                <th className="px-3 py-2 font-medium">Attempt ล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {groupedByStudent.map((row) => (
                <tr key={row.studentId} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">
                    {row.studentName ?? row.studentEmail}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.studentEmail}</td>
                  <td className="px-3 py-2">{row.attempts}</td>
                  <td className="px-3 py-2">{row.averageScore.toFixed(2)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(row.lastAttemptAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {groupedByStudent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    ยังไม่มีข้อมูลตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
