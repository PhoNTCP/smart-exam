"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ChartPoint = {
  id: string;
  label: string;
  score: number;
  averageDifficulty: number | null;
  thetaEnd: number;
  startedAt: string;
  subjectName: string;
  examTitle: string;
  answered: number;
  isAdaptive: boolean;
};

type AttemptCard = {
  id: string;
  examTitle: string;
  subjectName: string;
  status: "completed" | "in-progress";
  score: number;
  thetaStart: number;
  thetaEnd: number;
  updatedAt: string;
  answered: number;
  isAdaptive: boolean;
};

type LatestAttempt = {
  examTitle: string;
  subjectName: string;
  finishedAt: string | null;
  startedAt: string;
  score: number;
  thetaStart: number;
  thetaEnd: number;
  answered: number;
  averageDifficulty: number | null;
  isAdaptive: boolean;
} | null;

type StudentProgressDashboardProps = {
  data: {
    summary: {
      totalAttempts: number;
      completedAttempts: number;
      averageDifficultyEncountered: number | null;
    };
    latestAttempt: LatestAttempt;
    chartData: ChartPoint[];
    attempts: AttemptCard[];
    subjects: string[];
  };
};

const SUBJECT_COLORS = ["#0ea5e9", "#f97316", "#10b981", "#ef4444", "#8b5cf6", "#eab308", "#14b8a6", "#f43f5e"];

const difficultyLabel = (value: number | null) => (value === null ? "-" : value.toFixed(2));

export const StudentProgressDashboard = ({ data }: StudentProgressDashboardProps) => {
  const [selectedSubject, setSelectedSubject] = useState<string>("all");

  const subjectColorMap = useMemo(
    () => new Map(data.subjects.map((subjectName, index) => [subjectName, SUBJECT_COLORS[index % SUBJECT_COLORS.length]])),
    [data.subjects],
  );

  const filteredChartData = useMemo(
    () =>
      data.chartData
        .filter((point) => (selectedSubject === "all" ? true : point.subjectName === selectedSubject))
        .map((point, index) => ({
          ...point,
          label: `ครั้งที่ ${index + 1}`,
        })),
    [data.chartData, selectedSubject],
  );

  const filteredAttempts = useMemo(
    () =>
      data.attempts.filter((attempt) =>
        selectedSubject === "all" ? true : attempt.subjectName === selectedSubject,
      ),
    [data.attempts, selectedSubject],
  );

  const visibleSummary = useMemo(() => {
    if (filteredAttempts.length === 0) {
      return {
        totalAttempts: 0,
        completedAttempts: 0,
        averageDifficultyEncountered: null as number | null,
      };
    }

    const completedAttempts = filteredAttempts.filter((attempt) => attempt.status === "completed").length;
    const difficultyPoints = filteredChartData.filter((point) => point.averageDifficulty !== null);

    return {
      totalAttempts: filteredAttempts.length,
      completedAttempts,
      averageDifficultyEncountered:
        difficultyPoints.length > 0
          ? difficultyPoints.reduce((sum, point) => sum + (point.averageDifficulty ?? 0), 0) /
            difficultyPoints.length
          : null,
    };
  }, [filteredAttempts, filteredChartData]);

  const subjectSummaries = useMemo(
    () =>
      data.subjects.map((subjectName) => {
        const attempts = data.attempts.filter((attempt) => attempt.subjectName === subjectName);
        const points = data.chartData.filter((point) => point.subjectName === subjectName);
        const totalScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
        const completedCount = attempts.filter((attempt) => attempt.status === "completed").length;
        const difficultyPoints = points.filter((point) => point.averageDifficulty !== null);

        return {
          subjectName,
          attempts: attempts.length,
          averageScore: attempts.length > 0 ? totalScore / attempts.length : 0,
          completedCount,
          averageDifficulty:
            difficultyPoints.length > 0
              ? difficultyPoints.reduce((sum, point) => sum + (point.averageDifficulty ?? 0), 0) /
                difficultyPoints.length
              : null,
          latestAt: attempts[0]?.updatedAt ?? null,
          color: subjectColorMap.get(subjectName) ?? SUBJECT_COLORS[0],
        };
      }),
    [data.attempts, data.chartData, data.subjects, subjectColorMap],
  );

  const selectedLatestAttempt = useMemo(() => {
    if (selectedSubject === "all") {
      return data.latestAttempt;
    }

    const latest = filteredAttempts[0];
    if (!latest) {
      return null;
    }

    const point = filteredChartData.find((item) => item.id === latest.id);
    return {
      examTitle: latest.examTitle,
      subjectName: latest.subjectName,
      finishedAt: latest.status === "completed" ? latest.updatedAt : null,
      startedAt: point?.startedAt ?? latest.updatedAt,
      score: latest.score,
      thetaStart: latest.thetaStart,
      thetaEnd: latest.thetaEnd,
      answered: latest.answered,
      averageDifficulty: point?.averageDifficulty ?? null,
      isAdaptive: latest.isAdaptive,
    };
  }, [data.latestAttempt, filteredAttempts, filteredChartData, selectedSubject]);

  const chartLegendSubjects = useMemo(
    () =>
      Array.from(new Set(filteredChartData.map((point) => point.subjectName))).map((subjectName) => ({
        subjectName,
        color: subjectColorMap.get(subjectName) ?? SUBJECT_COLORS[0],
      })),
    [filteredChartData, subjectColorMap],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">ความคืบหน้า</h1>
        <p className="text-sm text-muted-foreground">
          ดูคะแนนย้อนหลังได้ง่ายขึ้นด้วยการแยกตามรายวิชาและโฟกัสเฉพาะวิชาที่ต้องการ
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>เลือกวิชา</CardTitle>
          <CardDescription>สลับดูกราฟและประวัติการทำข้อสอบแยกตามรายวิชา</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedSubject === "all" ? "default" : "outline"}
              onClick={() => setSelectedSubject("all")}
            >
              ทุกวิชา
            </Button>
            {data.subjects.map((subjectName) => (
              <Button
                key={subjectName}
                variant={selectedSubject === subjectName ? "default" : "outline"}
                onClick={() => setSelectedSubject(subjectName)}
              >
                {subjectName}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {subjectSummaries.map((subject) => (
              <Card
                key={subject.subjectName}
                className={selectedSubject === subject.subjectName ? "border-primary" : ""}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} />
                    <CardTitle className="text-lg">{subject.subjectName}</CardTitle>
                  </div>
                  <CardDescription>ทำไป {subject.attempts} ครั้ง</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    คะแนนเฉลี่ย:{" "}
                    <span className="font-medium text-foreground">{subject.averageScore.toFixed(2)}</span>
                  </p>
                  <p>
                    ทำเสร็จแล้ว:{" "}
                    <span className="font-medium text-foreground">{subject.completedCount}</span>
                  </p>
                  <p>
                    ความยากเฉลี่ย:{" "}
                    <span className="font-medium text-foreground">
                      {difficultyLabel(subject.averageDifficulty)}
                    </span>
                  </p>
                  <p>
                    ล่าสุด:{" "}
                    <span className="font-medium text-foreground">
                      {subject.latestAt ? new Date(subject.latestAt).toLocaleDateString() : "-"}
                    </span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>จำนวนครั้งที่ทำ</CardTitle>
            <CardDescription>{selectedSubject === "all" ? "รวมทุกวิชา" : selectedSubject}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{visibleSummary.totalAttempts}</p>
            <p className="text-xs text-muted-foreground">
              เสร็จสมบูรณ์ {visibleSummary.completedAttempts} ครั้ง
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ระดับความยากเฉลี่ย</CardTitle>
            <CardDescription>คำนวณจากข้อที่เจอในมุมมองปัจจุบัน</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {difficultyLabel(visibleSummary.averageDifficultyEncountered)}
            </p>
            <p className="text-xs text-muted-foreground">ระดับ 1 = ง่าย, ระดับ 5 = ยาก</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ข้อสอบล่าสุด</CardTitle>
            <CardDescription>{selectedSubject === "all" ? "ทุกวิชา" : selectedSubject}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold leading-tight">
              {selectedLatestAttempt ? selectedLatestAttempt.examTitle : "-"}
            </p>
            <p className="text-sm text-muted-foreground">
              {selectedLatestAttempt
                ? `${selectedLatestAttempt.subjectName} • ${
                    selectedLatestAttempt.finishedAt ? "ทำเสร็จแล้ว" : "กำลังทำอยู่"
                  }`
                : "ยังไม่มีข้อมูลล่าสุด"}
            </p>
            {selectedLatestAttempt && (
              <p className="text-sm text-muted-foreground">
                ผลล่าสุด:{" "}
                <span className="font-medium text-foreground">
                  {selectedLatestAttempt.score} / {selectedLatestAttempt.answered}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedLatestAttempt && (
        <Card>
          <CardHeader>
            <CardTitle>Attempt ล่าสุด</CardTitle>
            <CardDescription>
              {selectedLatestAttempt.subjectName} • {selectedLatestAttempt.examTitle}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <p>
              คะแนน:{" "}
              <span className="font-medium text-foreground">
                {selectedLatestAttempt.score} / {selectedLatestAttempt.answered}
              </span>
            </p>
            {selectedLatestAttempt.isAdaptive && (
              <p>
                theta:{" "}
                <span className="font-medium text-foreground">
                  {selectedLatestAttempt.thetaStart.toFixed(2)} {"->"} {selectedLatestAttempt.thetaEnd.toFixed(2)}
                </span>
              </p>
            )}
            <p>เริ่มทำเมื่อ: {new Date(selectedLatestAttempt.startedAt).toLocaleString()}</p>
            <p>
              เสร็จเมื่อ:{" "}
              {selectedLatestAttempt.finishedAt
                ? new Date(selectedLatestAttempt.finishedAt).toLocaleString()
                : "กำลังทำอยู่"}
            </p>
            <p>
              ความยากเฉลี่ย:{" "}
              <span className="font-medium text-foreground">
                {difficultyLabel(selectedLatestAttempt.averageDifficulty)}
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>กราฟคะแนน</CardTitle>
          <CardDescription>
            {selectedSubject === "all"
              ? "แสดงคะแนนแต่ละครั้งของทุกวิชา โดยใช้สีแยกตามรายวิชา"
              : `แสดงคะแนนเฉพาะวิชา ${selectedSubject}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          {filteredChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลพอสำหรับแสดงกราฟ</p>
          ) : (
            <div className="flex h-full flex-col gap-3">
              {selectedSubject === "all" && chartLegendSubjects.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {chartLegendSubjects.map((item) => (
                    <div
                      key={item.subjectName}
                      className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground"
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.subjectName}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      formatter={(value) => [String(value), "คะแนน"]}
                      labelFormatter={(label, payload) => {
                        const point = payload?.[0]?.payload as ChartPoint | undefined;
                        return point ? `${label} • ${point.subjectName} • ${point.examTitle}` : String(label);
                      }}
                    />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                      {filteredChartData.map((point) => (
                        <Cell
                          key={point.id}
                          fill={
                            selectedSubject === "all"
                              ? (subjectColorMap.get(point.subjectName) ?? SUBJECT_COLORS[0])
                              : SUBJECT_COLORS[0]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredAttempts.map((attempt) => (
          <Card key={attempt.id}>
            <CardHeader>
              <CardTitle>{attempt.examTitle}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span>{attempt.subjectName}</span>
                <Badge variant={attempt.status === "completed" ? "default" : "secondary"}>
                  {attempt.status}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                คะแนน:{" "}
                <span className="font-medium text-foreground">
                  {attempt.score} / {attempt.answered}
                </span>
              </p>
              {attempt.isAdaptive && (
                <p>
                  theta:{" "}
                  <span className="font-medium text-foreground">
                    {attempt.thetaStart.toFixed(2)} {"->"} {attempt.thetaEnd.toFixed(2)}
                  </span>
                </p>
              )}
              <p>อัปเดตล่าสุด: {new Date(attempt.updatedAt).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
        {filteredAttempts.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>ยังไม่มีข้อมูล</CardTitle>
              <CardDescription>เริ่มทำข้อสอบเพื่อดูความคืบหน้าของวิชานี้</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
};
