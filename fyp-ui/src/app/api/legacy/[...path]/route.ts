import { proxyToUpstreamApi } from "@/lib/server/upstream-proxy";

function toUpstreamPath(rest: string[]): string {
  // Frontend: /api/legacy/<rest>
  // Upstream: /<rest>
  return `/${rest.map(encodeURIComponent).join("/")}`;
}

export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  return proxyToUpstreamApi(req, toUpstreamPath(path ?? []));
}

export async function POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  return proxyToUpstreamApi(req, toUpstreamPath(path ?? []));
}

export async function PUT(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  return proxyToUpstreamApi(req, toUpstreamPath(path ?? []));
}

export async function PATCH(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  return proxyToUpstreamApi(req, toUpstreamPath(path ?? []));
}

export async function DELETE(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  return proxyToUpstreamApi(req, toUpstreamPath(path ?? []));
}
