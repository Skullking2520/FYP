"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getAdminStats } from "@/lib/admin-api";
import { isAdminUser } from "@/lib/admin";
import type { AdminSkillRecoPickPoint, AdminStats, AdminTopItem } from "@/types/admin";

function formatNumber(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat().format(value);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 10) / 10}%`;
}

function SkillRecoPickChart({ series }: { series: AdminSkillRecoPickPoint[] | undefined }) {
  const normalized = useMemo(() => {
    const src = Array.isArray(series) ? series : [];
    return src
      .filter((p) => p && typeof p.date === "string")
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  }, [series]);

  const maxTotal = useMemo(() => {
    if (normalized.length === 0) return 0;
    return Math.max(...normalized.map((p) => p.total_picks ?? 0));
  }, [normalized]);

  const latest = normalized.length > 0 ? normalized[normalized.length - 1] : null;
  const top1Rate = latest && latest.total_picks > 0 ? (latest.top1_picks / latest.total_picks) * 100 : null;
  const top5Rate = latest && latest.total_picks > 0 ? (latest.top5_picks / latest.total_picks) * 100 : null;

  if (normalized.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        아직 데이터가 없습니다. (백엔드에서 추천-선택 이벤트 로그/집계 API가 추가되면 표시됩니다.)
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-background p-3">
          <div className="text-xs text-muted-foreground">최근 일자</div>
          <div className="text-sm font-semibold text-foreground">{latest?.date ?? "—"}</div>
        </div>
        <div className="rounded-xl border bg-background p-3">
          <div className="text-xs text-muted-foreground">Top-1 선택률</div>
          <div className="text-sm font-semibold text-foreground">{formatPercent(top1Rate)}</div>
        </div>
        <div className="rounded-xl border bg-background p-3">
          <div className="text-xs text-muted-foreground">Top-5 내 선택률</div>
          <div className="text-sm font-semibold text-foreground">{formatPercent(top5Rate)}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-foreground">일자별 선택 횟수</div>
          <div className="text-xs text-muted-foreground">최근 {normalized.length}일</div>
        </div>

        <div className="mt-4 grid grid-cols-14 items-end gap-2">
          {normalized.map((p) => {
            const pct = maxTotal > 0 ? (p.total_picks / maxTotal) * 100 : 0;
            return (
              <div key={p.date} className="flex flex-col items-center gap-2">
                <div className="h-24 w-full rounded-md bg-muted/50 flex items-end">
                  <div
                    className="w-full rounded-md bg-blue-600"
                    style={{ height: `${clampPercent(pct)}%` }}
                    title={`${p.date}: ${p.total_picks}`}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground">{p.date.slice(5)}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          정의: 사용자가 스킬 기반 추천 리스트에서 실제로 선택한 직업 횟수 (정확도 대신 ‘선택 기반 적합도’ 지표)
        </div>
      </div>
    </div>
  );
}

function TopList({ items }: { items: AdminTopItem[] | undefined }) {
  const max = useMemo(() => {
    if (!items || items.length === 0) return 0;
    return Math.max(...items.map((item) => item.count));
  }, [items]);

  if (!items || items.length === 0) {
    return <div className="text-sm text-muted-foreground">데이터가 없습니다.</div>;
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 8).map((item) => {
        const pct = max > 0 ? (item.count / max) * 100 : 0;
        return (
          <div key={item.key} className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.key}</div>
              </div>
              <div className="shrink-0 text-sm font-semibold text-foreground">{formatNumber(item.count)}</div>
            </div>
            <Progress value={clampPercent(pct)} />
          </div>
        );
      })}
    </div>
  );
}

function BucketList({ items }: { items: AdminStats["match_score_buckets"] }) {
  const max = useMemo(() => {
    if (!items || items.length === 0) return 0;
    return Math.max(...items.map((item) => item.count));
  }, [items]);

  if (!items || items.length === 0) {
    return <div className="text-sm text-muted-foreground">데이터가 없습니다.</div>;
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 10).map((bucket) => {
        const pct = max > 0 ? (bucket.count / max) * 100 : 0;
        return (
          <div key={bucket.label} className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-foreground">{bucket.label}</div>
              <div className="text-sm font-semibold text-foreground">{formatNumber(bucket.count)}</div>
            </div>
            <Progress value={clampPercent(pct)} />
          </div>
        );
      })}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { token, user, loading } = useAuth();
  const isAdmin = isAdminUser(user);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/dashboard");
    }
  }, [loading, token, isAdmin, router]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setStatsLoading(true);
      setStatsError(null);
    });

    getAdminStats(token)
      .then((data) => {
        if (cancelled) return;
        setStats(data);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load admin stats";
        setStatsError(message);
        setStats(null);
      })
      .finally(() => {
        if (cancelled) return;
        setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, isAdmin]);

  if (!token || !isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Admin Console</h1>
          <p className="text-sm text-muted-foreground">어드민 전용 통계/카탈로그 관리 화면입니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/programs"
            className="rounded-xl border bg-background px-4 py-2 text-sm font-semibold text-foreground"
          >
            Programs
          </Link>
          <Link
            href="/admin/universities"
            className="rounded-xl border bg-background px-4 py-2 text-sm font-semibold text-foreground"
          >
            Universities
          </Link>
          <Link
            href="/admin/create-admin"
            className="rounded-xl border bg-background px-4 py-2 text-sm font-semibold text-foreground"
          >
            Create admin
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>계정 수</CardTitle>
            <CardDescription>전체 등록 계정</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{statsLoading ? "…" : formatNumber(stats?.accounts_total)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>프로필 작성</CardTitle>
            <CardDescription>프로필 정보 보유 계정</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{statsLoading ? "…" : formatNumber(stats?.accounts_with_profile)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>직업 선택</CardTitle>
            <CardDescription>선택/저장된 직업 합계</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{statsLoading ? "…" : formatNumber(stats?.job_selections_total)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>스킬 매칭</CardTitle>
            <CardDescription>평균 매칭 점수(0~1)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {statsLoading
                ? "…"
                : typeof stats?.match_score_avg === "number"
                  ? stats.match_score_avg.toFixed(3)
                  : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {statsError && (
        <Card>
          <CardHeader>
            <CardTitle>통계 로딩 실패</CardTitle>
            <CardDescription>
              현재 UI는 `GET /admin/stats`(Bearer 토큰 필요) 응답을 기대합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-destructive">{statsError}</div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>스킬 기반 추천 선택</CardTitle>
            <CardDescription>추천된 직업 중 사용자가 실제로 고른 횟수/비율(품질 지표)</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="text-sm text-muted-foreground">불러오는 중…</div>
            ) : (
              <SkillRecoPickChart series={stats?.skill_reco_picks_series} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Top 직업</CardTitle>
            <CardDescription>계정들이 선택한 직업 TOP</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? <div className="text-sm text-muted-foreground">불러오는 중…</div> : <TopList items={stats?.top_jobs} />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Top 스킬</CardTitle>
            <CardDescription>사용자 입력/추출 스킬 TOP</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? <div className="text-sm text-muted-foreground">불러오는 중…</div> : <TopList items={stats?.top_skills} />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>매칭 분포</CardTitle>
            <CardDescription>점수 구간별 분포</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="text-sm text-muted-foreground">불러오는 중…</div>
            ) : (
              <BucketList items={stats?.match_score_buckets} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
