interface Env {
  DB: D1Database;
}

function buildWhere(url: URL) {
  const conditions: string[] = [];
  const params: any[] = [];
  const influencer = url.searchParams.get('influencer');
  const source = url.searchParams.get('source');
  const month = url.searchParams.get('month');
  const orderType = url.searchParams.get('order_type');
  const payStatus = url.searchParams.get('pay_status');

  if (influencer) {
    if (influencer === '其他') {
      conditions.push("(达人名称 IS NULL OR 达人名称 = '')");
    } else {
      conditions.push(`达人名称 = ?${params.length + 1}`);
      params.push(influencer);
    }
  }
  if (source) {
    conditions.push(`订单来源 = ?${params.length + 1}`);
    params.push(source);
  }
  if (month) {
    conditions.push(`数据月份 = ?${params.length + 1}`);
    params.push(month);
  }
  if (orderType) {
    conditions.push(`订单类型 = ?${params.length + 1}`);
    params.push(orderType);
  }
  if (payStatus) {
    conditions.push(`支付属性 = ?${params.length + 1}`);
    params.push(payStatus);
  }

  const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  return { where, params };
}

async function handleFilters(env: Env): Promise<Response> {
  const db = env.DB;
  const influencers = (await db.prepare(
    "SELECT DISTINCT 达人名称 FROM orders WHERE 达人名称 IS NOT NULL AND 达人名称 != '' ORDER BY 达人名称"
  ).all()).results.map((r: any) => r.达人名称);

  const emptyCount = (await db.prepare(
    "SELECT COUNT(*) AS cnt FROM orders WHERE 达人名称 IS NULL OR 达人名称 = ''"
  ).first()) as any;
  if (emptyCount && emptyCount.cnt > 0) {
    influencers.unshift('其他');
  }

  const sources = (await db.prepare(
    "SELECT DISTINCT 订单来源 FROM orders ORDER BY 订单来源"
  ).all()).results.map((r: any) => r.订单来源);

  const months = (await db.prepare(
    "SELECT DISTINCT 数据月份 FROM orders ORDER BY 数据月份"
  ).all()).results.map((r: any) => r.数据月份);

  const orderTypes = (await db.prepare(
    "SELECT DISTINCT 订单类型 FROM orders ORDER BY 订单类型"
  ).all()).results.map((r: any) => r.订单类型);

  const payStatuses = (await db.prepare(
    "SELECT DISTINCT 支付属性 FROM orders ORDER BY 支付属性"
  ).all()).results.map((r: any) => r.支付属性);

  return Response.json({ influencers, sources, months, order_types: orderTypes, pay_statuses: payStatuses });
}

async function handleSummary(url: URL, env: Env): Promise<Response> {
  const { where, params } = buildWhere(url);
  const db = env.DB;
  const stmt = db.prepare(
    `SELECT COUNT(*) AS total_orders, ` +
    `COALESCE(SUM(CASE WHEN 支付属性='已支付' THEN 1 ELSE 0 END), 0) AS paid_count, ` +
    `COALESCE(SUM(CASE WHEN 支付属性='未支付' THEN 1 ELSE 0 END), 0) AS unpaid_count, ` +
    `COALESCE(ROUND(SUM(订单金额_元), 2), 0) AS total_amount, ` +
    `COALESCE(ROUND(SUM(实付金额), 2), 0) AS total_paid_amount ` +
    `FROM orders${where}`
  );
  const row = (await (params.length > 0 ? stmt.bind(...params) : stmt).first()) as any;
  return Response.json(row || { total_orders: 0, paid_count: 0, unpaid_count: 0, total_amount: 0, total_paid_amount: 0 });
}

async function handleOrders(url: URL, env: Env): Promise<Response> {
  const { where, params } = buildWhere(url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('page_size') || '20');
  const offset = (page - 1) * pageSize;
  const db = env.DB;

  const countStmt = db.prepare(`SELECT COUNT(*) AS total FROM orders${where}`);
  const totalRow = (await (params.length > 0 ? countStmt.bind(...params) : countStmt).first()) as any;
  const total = totalRow?.total || 0;

  const stmt = db.prepare(
    `SELECT 订单编号, 计划名称, 用户下单时间, 订单金额_元, 实付金额, ` +
    `达人名称, 订单来源, 订单类型, 支付属性, 数据月份 ` +
    `FROM orders${where} ORDER BY 用户下单时间 DESC, 订单编号 DESC ` +
    `LIMIT ?${params.length + 1} OFFSET ?${params.length + 2}`
  );
  const allParams = [...params, pageSize, offset];
  const { results } = await stmt.bind(...allParams).all();

  return Response.json({ total, page, page_size: pageSize, data: results });
}

async function handleStatsMonthly(url: URL, env: Env): Promise<Response> {
  const { where, params } = buildWhere(url);
  const db = env.DB;
  const stmt = db.prepare(
    `SELECT 数据月份, COUNT(*) AS cnt, ROUND(SUM(订单金额_元), 2) AS amount ` +
    `FROM orders${where} GROUP BY 数据月份 ORDER BY 数据月份`
  );
  const { results } = await (params.length > 0 ? stmt.bind(...params) : stmt).all();
  return Response.json(results);
}

async function handleStatsInfluencer(url: URL, env: Env): Promise<Response> {
  const { where, params } = buildWhere(url);
  const topN = parseInt(url.searchParams.get('top_n') || '10');
  const db = env.DB;
  const andOrWhere = where ? ' AND ' : ' WHERE ';
  const stmt = db.prepare(
    `SELECT 达人名称, COUNT(*) AS cnt, ROUND(SUM(订单金额_元), 2) AS amount ` +
    `FROM orders${where}` + andOrWhere +
    `达人名称 IS NOT NULL AND 达人名称 != '' ` +
    `GROUP BY 达人名称 ORDER BY cnt DESC LIMIT ?${params.length + 1}`
  );
  const { results } = await stmt.bind(...params, topN).all();
  return Response.json(results);
}

async function handleStatsSource(url: URL, env: Env): Promise<Response> {
  const { where, params } = buildWhere(url);
  const db = env.DB;
  const stmt = db.prepare(
    `SELECT 订单来源, COUNT(*) AS cnt, ROUND(SUM(订单金额_元), 2) AS amount ` +
    `FROM orders${where} GROUP BY 订单来源 ORDER BY cnt DESC`
  );
  const { results } = await (params.length > 0 ? stmt.bind(...params) : stmt).all();
  return Response.json(results);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 只处理 /api/* 请求，其他交给静态资源
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const path = url.pathname.replace(/^\/api\/?/, '');

    try {
      switch (path) {
        case 'filters':
          return handleFilters(env);
        case 'summary':
          return handleSummary(url, env);
        case 'orders':
          return handleOrders(url, env);
        case 'stats/monthly':
          return handleStatsMonthly(url, env);
        case 'stats/influencer':
          return handleStatsInfluencer(url, env);
        case 'stats/source':
          return handleStatsSource(url, env);
        default:
          return Response.json({ error: 'Not found' }, { status: 404 });
      }
    } catch (e: any) {
      console.error('API Error:', e.message);
      return Response.json({ error: e.message }, { status: 500 });
    }
  }
};
