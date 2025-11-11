"use client";

import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ChartPoint = {
  id: string;
  label: string;
  score: number;
  averageDifficulty: number | null;
  thetaEnd: number;
  startedAt: string;
};

type AttemptCard = {
  id: string;
  examTitle: string;
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
  };
};

const difficultyLabel = (value: number | null) =>
  value === null ? "—" : value.toFixed(2);

export const StudentProgressDashboard = ({ data }: StudentProgressDashboardProps) => {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">ความคืบหน้า</h1>
        <p className="text-sm text-muted-foreground">
          ติดตามผลการสอบแบบ Adaptive พร้อมโน้ตดีพลอย: ทำอย่างสม่ำเสมอแล้วความแม่นยำจะดีขึ้นเอง
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>จำนวนครั้งที่ทำ</CardTitle>
            <CardDescription>ความพยายามทั้งหมดของคุณ</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{data.summary.totalAttempts}</p>
            <p className="text-xs text-muted-foreground">
              เสร็จสมบูรณ์ {data.summary.completedAttempts} ครั้ง
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ระดับความยากเฉลี่ย</CardTitle>
            <CardDescription>เฉลี่ยจากทุกคำถามที่คุณเจอ</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {difficultyLabel(data.summary.averageDifficultyEncountered)}
            </p>
            <p className="text-xs text-muted-foreground">ระดับ 1 = ง่าย, ระดับ 5 = ยาก</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>จังหวะล่าสุด</CardTitle>
            <CardDescription>θ ปัจจุบันของคุณ</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {data.latestAttempt && data.latestAttempt.isAdaptive
                ? data.latestAttempt.thetaEnd.toFixed(2)
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              θ เริ่มต้น:{" "}
              {data.latestAttempt && data.latestAttempt.isAdaptive
                ? data.latestAttempt.thetaStart.toFixed(2)
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {data.latestAttempt && (
        <Card>
          <CardHeader>
            <CardTitle>Attempt ล่าสุด</CardTitle>
            <CardDescription>{data.latestAttempt.examTitle}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
            <p>
              คะแนน:{" "}
              <span className="font-medium text-foreground">
                {data.latestAttempt.score} / {data.latestAttempt.answered}
              </span>
            </p>
            {data.latestAttempt.isAdaptive && (
              <p>
                θ:{" "}
                <span className="font-medium text-foreground">
                  {data.latestAttempt.thetaStart.toFixed(2)} ➜ {data.latestAttempt.thetaEnd.toFixed(2)}
                </span>
              </p>
            )}
            <p>เริ่มทำเมื่อ: {new Date(data.latestAttempt.startedAt).toLocaleString()}</p>
            <p>
              เสร็จเมื่อ:{" "}
              {data.latestAttempt.finishedAt
                ? new Date(data.latestAttempt.finishedAt).toLocaleString()
                : "กำลังทำอยู่"}
            </p>
            <p>
              ระดับความยากเฉลี่ย:{" "}
              {difficultyLabel(data.latestAttempt.averageDifficulty)}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>กราฟคะแนน</CardTitle>
          <CardDescription>คะแนนแต่ละครั้งเทียบกับระดับความยากโดยประมาณ</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          {data.chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              ยังไม่มีข้อมูลเพียงพอสำหรับแสดงกราฟ
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis yAxisId="left" label={{ value: "คะแนน", angle: -90, position: "insideLeft" }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  label={{ value: "ความยาก", angle: 90, position: "insideRight" }}
                  domain={[1, 5]}
                />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  yAxisId="left"
                  activeDot={{ r: 6 }}
                  name="คะแนน"
                />
                <Line
                  type="monotone"
                  dataKey="averageDifficulty"
                  stroke="#f97316"
                  strokeWidth={2}
                  yAxisId="right"
                  name="ความยากเฉลี่ย"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.attempts.map((attempt) => (
          <Card key={attempt.id}>
            <CardHeader>
              <CardTitle>{attempt.examTitle}</CardTitle>
              <CardDescription>
                สถานะ:{" "}
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
                  θ:{" "}
                  <span className="font-medium text-foreground">
                    {attempt.thetaStart.toFixed(2)} ➜ {attempt.thetaEnd.toFixed(2)}
                  </span>
                </p>
              )}
              <p>อัปเดตล่าสุด: {new Date(attempt.updatedAt).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
        {data.attempts.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>ยังไม่มีข้อมูล</CardTitle>
              <CardDescription>เริ่มทำข้อสอบเพื่อดูความคืบหน้า</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
};
