import type { Db } from "@/lib/db/queries/papers";

/**
 * The weekly digest's reads — SERVICE ROLE, one user at a time.
 *
 * Every function here takes an explicit `userId` and filters on it. That is the
 * opposite of the rule the user-session queries follow (where filtering in
 * application code would wrongly imply it is the security boundary), and the
 * inversion is the point: the admin client bypasses RLS entirely, so here the
 * `eq("user_id", …)` IS the boundary. Omitting one would build a digest of
 * somebody else's thesis and email it to the wrong student.
 */

function unwrap<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

export interface DigestPaper {
  title: string;
  score: number | null;
  analysisId: string;
  completedAt: string;
}

export interface DigestData {
  analysesCompleted: number;
  findingsResolved: number;
  openTodos: number;
  papers: DigestPaper[];
}

/** How many papers the digest lists before it stops. */
const PAPER_LIMIT = 5;

/**
 * Everything one user's digest reports on, for the window since `sinceIso`.
 *
 * Four independent reads, run together — none depends on another's result, and
 * a digest that takes four sequential round trips per subscriber is what turns a
 * sweep into a timeout.
 */
export async function loadDigestData(
  db: Db,
  userId: string,
  sinceIso: string,
): Promise<DigestData> {
  const [completed, resolved, todos] = await Promise.all([
    db
      .from("paper_analyses")
      .select(
        "id, overall_score, completed_at, paper:papers(title)",
      )
      .eq("user_id", userId)
      .eq("status", "DONE")
      .gte("completed_at", sinceIso)
      .order("completed_at", { ascending: false })
      .limit(PAPER_LIMIT),

    db
      .from("findings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_resolved", true)
      .gte("resolved_at", sinceIso),

    db
      .from("todo_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_done", false),
  ]);

  const rows = unwrap(completed, "loadDigestData.analyses") as unknown as Array<{
    id: string;
    overall_score: number | null;
    completed_at: string | null;
    paper: { title: string } | null;
  }>;

  if (resolved.error) {
    throw new Error(`loadDigestData.findings: ${resolved.error.message}`);
  }
  if (todos.error) {
    throw new Error(`loadDigestData.todos: ${todos.error.message}`);
  }

  const papers: DigestPaper[] = rows.flatMap((row) =>
    row.completed_at
      ? [
          {
            title: row.paper?.title ?? "",
            score: row.overall_score,
            analysisId: row.id,
            completedAt: row.completed_at,
          },
        ]
      : [],
  );

  return {
    analysesCompleted: papers.length,
    findingsResolved: resolved.count ?? 0,
    openTodos: todos.count ?? 0,
    papers,
  };
}
