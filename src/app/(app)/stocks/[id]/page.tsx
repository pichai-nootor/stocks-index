import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { summarize, fmtChange, fmtNum, hasClose, evaluateCalls, CALL_MIN_GAP_PCT } from "@/lib/stats";
import { pickPair, top2, bottom2, randomAtLeastOne, dayStrength, DRILL_BASE, DRILL_PER_DIGIT } from "@/lib/digits";
import { todayThai, liveDirection, fmtThaiTime, evaluateLiveCalls } from "@/lib/intraday";
import { fetchQuote } from "@/lib/yahoo";
import { YahooOpenButton } from "@/components/yahoo-open-button";
import { CloseYahooButton } from "@/components/close-yahoo-button";
import { NikkeiSetup } from "../nikkei-setup";
import { nikkeiSession } from "@/lib/stocks/nikkei";
import { NIKKEI_PAIR_STRONG, NIKKEI_PAIR_BASE } from "@/lib/formulas/stocks/nikkei";
import { chinaSession } from "@/lib/stocks/china";
import { CHINA_PAIR_STRONG, CHINA_DOUBLE, CHINA_PAIR } from "@/lib/formulas/stocks/china";
import { SENSEX_PAIR } from "@/lib/formulas/stocks/sensex";
import { EgyptSetup, EgyptOpenNextButton, EgyptOpenPasteForm } from "../egypt-setup";
import { ChinaSetup } from "../china-setup";
import { HangSengSetup } from "../hangseng-setup";
import { DowJonesSetup } from "../dowjones-setup";
import { isDowJones } from "@/lib/stocks/dowjones";
import { ManualOpenForm } from "@/components/manual-open-form";
import { OpenInlineEdit } from "@/components/open-inline-edit";
import { hangSengSession } from "@/lib/stocks/hangseng";
import { pickTwoFor, amDigitsFor, latePickFor } from "@/lib/formulas/stocks";
import { lockUserStockPicks } from "@/lib/stock-lock";
import { betResult } from "@/lib/bet";
import { LateCard } from "@/components/late-card";
import { ScrollHere } from "@/components/scroll-here";
import { TryRangeForm } from "@/components/try-range-form";
import { pctKeyOf, closeBandStats } from "@/lib/pct-stats";
import { openRangeHistory, openRangePick } from "@/lib/open-range";
import { isEgypt, egyptNextTradingDay } from "@/lib/stocks/egypt";
import { EGYPT_2026 } from "@/lib/formulas/stocks/egypt";
import { LiveSaveButton } from "@/components/live-save-button";
import { LiveManualForm } from "@/components/live-manual-form";
import { SHOW_DIRECTION } from "@/lib/config";
import { deleteRecord, deleteStock } from "@/app/actions/stocks";
import { StatCard } from "@/components/stat-card";
import { Change } from "@/components/change";
import { RecordEdit } from "@/components/record-edit";
import { PatternMatrix } from "@/components/pattern-matrix";
import { Digits } from "@/components/digit-badges";
import { PickRow, HitBadge } from "@/components/pick-view";
import { RecordForm } from "./record-form";
import { CloseForm } from "@/components/close-form";
import { ImportForm } from "./import-form";
import { Pagination, paginate } from "@/components/pagination";

export default async function StockDetailPage({ params, searchParams }: PageProps<"/stocks/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  // ลองคาดช่วง % ปิด (ไม่บันทึก ไม่นับคะแนน): ?tid=<record id>&pf=<% ตั้งแต่>&pt=<% ถึง> — ใช้ได้ทั้งวันที่ยังไม่ปิดและปิดแล้ว
  const pnum = (v: unknown) => { const t = typeof v === "string" ? v.replace(/[%\s]/g, "").replace(/[−–]/g, "-").replace(",", ".") : ""; const n = t === "" ? NaN : Number(t.endsWith(".") ? t.slice(0, -1) : t); return n; };
  const tryId = typeof sp.tid === "string" ? sp.tid : null;
  const tryFrom = pnum(sp.pf), tryTo = pnum(sp.pt);
  const tryOk = Number.isFinite(tryFrom) && Number.isFinite(tryTo);
  const { userId } = await requireUser();
  await lockUserStockPicks(userId); // ล็อกเลขฟันของงวดที่รอผล (รายงานนับเฉพาะเลขล็อก)
  const stock = await prisma.stock.findFirst({
    where: { id, userId },
    include: { records: { orderBy: { date: "asc" } } },
  });
  if (!stock) notFound();

  const closed = stock.records.filter(hasClose);
  const bandKey = pctKeyOf(stock.symbol);
  const band = tryId && tryOk && bandKey ? await closeBandStats(bandKey, tryFrom, tryTo) : null;
  const orHist = bandKey ? await openRangeHistory(bandKey) : null; // วิธีของผู้ใช้: เปิด → ช่วง % ปิด → เลขรูด
  const st = summarize(closed);

  // ฟันธงของแต่ละวัน: ใช้เฉพาะวันที่ปิดแล้ว "ก่อนหน้า" วันนั้น (สำหรับทิศทาง)
  const egypt = isEgypt(stock.symbol);
  const nikkei = !!nikkeiSession(stock.symbol);
  const china = !!chinaSession(stock.symbol);
  const pm = chinaSession(stock.symbol) === "pm"; // รอบของหุ้นจีน (สถิติเบิ้ลคนละค่ากัน)
  const hsSession = hangSengSession(stock.symbol);
  const hangseng = !!hsSession; // ฮั่งเส็งใช้สูตรของตัวเอง (formulas/stocks/hangseng.ts) ไม่ใช้ pickTwo กลาง
  const dow = isDowJones(stock.symbol); // ดาวโจนส์ใช้สูตรของตัวเอง (formulas/stocks/dowjones.ts)
  const manualOpen = hsSession === "pm" || (china && pm) || nikkeiSession(stock.symbol) === "pm"; // รอบบ่าย (ฮั่งเส็ง/จีน/นิเคอิ): ผู้ใช้กรอกเปิดเองทั้งหมด แทนปุ่ม Yahoo
  const sensex = !egypt && !nikkei && !china && !hangseng && !dow; // หลักฐาน 10 ปีในไฟล์กลางเป็นของ SENSEX — ห้ามเอาไปแสดงบนหุ้นตัวอื่น
  // อียิปต์: ปิดป้าย ★ งวดคู่ผูกแข็ง เพราะข้อมูลของอียิปต์เองบอกว่ากลับด้าน (13.6% vs 21.3%)
  const pairStrong = egypt ? 99 : china ? CHINA_PAIR_STRONG : sensex ? SENSEX_PAIR.threshold : NIKKEI_PAIR_STRONG; // เกณฑ์ "งวดคู่ผูกแข็ง" — ค่าเท่ากันเพราะมาจากโครงสร้าง D
  const pairEvidence = egypt ? "อียิปต์: วันแบบนี้ถูกครบ 24.6% เทียบวันอื่น 18.4%"
    : china ? `สถิติจีน${pm ? "บ่าย 10 ปี" : "เช้า 2 ปี"}: งวดแบบนี้ถูกครบ ${Math.round((pm ? CHINA_PAIR.pm.strong : CHINA_PAIR.am.strong) * 100)}% เทียบงวดอื่น ${Math.round((pm ? CHINA_PAIR.pm.other : CHINA_PAIR.am.other) * 100)}%`
    : sensex ? `SENSEX 10 ปี: งวดแบบนี้ถูกครบ ${Math.round(SENSEX_PAIR.strong * 100)}% เทียบงวดอื่น ${Math.round(SENSEX_PAIR.other * 100)}%`
    : `นิเคอิบ่าย: ${Math.round(NIKKEI_PAIR_BASE.pm.strong * 100)}% เทียบปกติ ${Math.round(NIKKEI_PAIR_BASE.pm.both * 100)}%`;
  // รอบบ่ายจีน/นิเคอิ: เลขเสมอเลือกจากเลขที่ออกรอบเช้า (ดู formulas/stocks/index.ts)
  const amSrc = manualOpen ? await prisma.stock.findMany({ where: { userId }, select: { symbol: true, records: { select: { date: true, closeValue: true, closeChange: true } } } }) : [];
  const am = amDigitsFor(amSrc, stock.symbol);
  const rows = stock.records.map((r, i) => {
    const history = closed.filter((d) => d.date.getTime() < r.date.getTime());
    // อียิปต์: วันที่ไม่มีค่าเปลี่ยนแปลงตอนเปิดจริง → คำนวณให้ = ปิด − เปิด ของวันนั้น (จากเปิดวันนั้น ราคาวิ่งไปเท่าไหร่)
    const fromOpen = egypt && r.openChange === 0 && hasClose(r) ? Math.round((r.closeValue - r.openValue) * 100) / 100 : null;
    const noOpenChange = egypt && r.openChange === 0 && fromOpen === null;
    const oTop = top2(r.openValue), oBot = bottom2(r.openChange);
    const two = pickTwoFor(stock.symbol, r.openValue, r.openChange, history, { date: r.date, am }); // สูตรของหุ้นตัวนี้ (formulas/stocks/<หุ้น>.ts)
    const amWait = "amWait" in two && !!two.amWait && !hasClose(r); // ผลเช้ายังไม่เข้า → ยังไม่มีเลขฟันจริง
    const pair = two.digits.map((x) => x.digit), pick = pair[0];
    const closeDigits = hasClose(r) ? [...new Set((top2(r.closeValue) + bottom2(r.closeChange)).split(""))] : null;
    const hit1 = pick !== null && closeDigits ? closeDigits.includes(pick) : null;
    const hit2 = pair && closeDigits ? pair.filter((d) => closeDigits.includes(d)) : null;
    // คู่ผูก (ถูกต้องครบทั้ง 2 ตัว) — แสดงให้อียิปต์และนิเคอิเหมือนกัน (อียิปต์ ≥23.5% ถูกจริง 24.6% · นิเคอิบ่าย 24.8%)
    const pp = egypt || nikkei || china ? pickPair(r.openValue, r.openChange, history) : null; // SENSEX ไม่แสดงคู่ผูก (17.6% ต่ำกว่าอียิปต์ 20.3% — ผู้ใช้ไม่เอา)
    const pairBoth = pp && closeDigits ? pp.pair.every((d) => closeDigits.includes(d)) : null;
    const star = two.standout.digit;
    const hitStar = closeDigits ? closeDigits.includes(star) : null;
    const weak = !hangseng && !dow && dayStrength(two.digits[0].p).level === "อ่อน"; // ฮั่งเส็ง: วันอ่อนแบบ SENSEX ไม่จริง (บ่าย <34% ถูก 50.5%)
    // โอกาสเบิ้ลของวัน: โครงสร้าง 20% (วัน D เบิ้ล 10%) · "จับตา" = เลขเปิด สิบ+หน่วย = 10 (10 ปี ~23–24% แต่ยังเป็นสัญญาณอ่อน)
    const sum10 = (x: string) => Number(x[0]) + Number(x[1]) === 10;
    const dblWatch = sum10(oTop) || sum10(oBot);
    const closeDbl = hasClose(r) ? [top2(r.closeValue), bottom2(r.closeChange)].filter((x) => x[0] === x[1]) : null;
    // จีน: สิ่งเดียวที่สถิติจีนเองยืนยันเรื่องเบิ้ล คือ "D เป็นเบิ้ล → โอกาสเบิ้ลต่ำลง" (บ่าย 16.1% vs 20.4% · เช้า 12.5% vs 19.2%)
    const dTwo = top2(r.openValue - r.openChange);
    const cnDoubleLow = china && dTwo[0] === dTwo[1];
    // เลขเจาะ (กลับได้): มาถ้าเท่ากับ บน/ล่าง ตรงหรือกลับ
    const closeNums = hasClose(r) ? [top2(r.closeValue), bottom2(r.closeChange)] : null;
    /**
     * ชุดวิน 5 ตัว สำหรับ "วิน 3 ตัวบน" — บน 3 หลัก = หลักหน่วยของดัชนี + ทศนิยม 2 ตำแหน่ง (เช่น 73,580.54 → 054)
     *   เข้าเมื่อทั้ง 3 หลักอยู่ในชุด · ซื้อ 125 เลข (โต๊ด 35 ชุด)
     *   SENSEX 10 ปี: ชุด 5 ตัว 13.2% (สุ่ม 12.2%) · 6 ตัว 22.6% · 7 ตัว 36.0% — แต้มต่อน้อยมากเพราะหลักหน่วยของดัชนีสุ่มล้วน
     */
    const winSetDigits = two.win.digits;
    const top3 = hasClose(r) ? `${Math.trunc(Math.abs(r.closeValue)) % 10}${top2(r.closeValue)}` : null;
    const win3Hit = top3 ? [...top3].every((c) => winSetDigits.includes(c)) : null;          // วิน 3 ตัวบน (125 เลข)
    const winBoth = closeNums ? [...closeNums[0]].every((c) => winSetDigits.includes(c)) && [...closeNums[1]].every((c) => winSetDigits.includes(c)) : null;
    const win2Hit = closeNums ? (([...closeNums[0]].every((c) => winSetDigits.includes(c)) ? "บน" : null) ?? ([...closeNums[1]].every((c) => winSetDigits.includes(c)) ? "ล่าง" : null)) : null; // วิน 2 ตัว บน/ล่าง (25 เลข)
    const drill = two.drill.sets.map((s) => ({ digit: s.digit, numbers: s.numbers.map((n) => n.number) }));
    const drillHits = closeNums ? drill.flatMap((s) => s.numbers).filter((m) => closeNums.includes(m) || closeNums.includes(m[1] + m[0])) : null;
    // ฟันช่วงท้าย (ทดลอง): ทิศจากราคาที่บันทึกก่อนปิด → ฟันชุดใหม่ เก็บคะแนนคู่กับชุดปกติ
    const lateTwo = r.liveValue !== null ? latePickFor(stock.symbol, r.openValue, r.openChange, r.liveValue, history, { date: r.date, am }) : null;
    const late = lateTwo && !lateTwo.amWait ? (() => {
      const lp = lateTwo.digits.map((x) => x.digit), ld = lateTwo.drill.sets.flatMap((x) => x.numbers.map((n) => n.number));
      return { up: lateTwo.up, pick: lp, drill: ld, hit: closeDigits ? lp.filter((d) => closeDigits.includes(d)) : null, drillHit: closeNums ? ld.some((m) => closeNums.includes(m) || closeNums.includes(m[1] + m[0])) : null,
        money: closeNums ? { late: betResult(lp, ld, closeNums[0], closeNums[1]).profit, base: betResult(pair, drill.flatMap((x) => x.numbers), closeNums[0], closeNums[1]).profit } : null };
    })() : null;
    // วิธีของผู้ใช้ (ทดลอง): เปิด → คาดช่วง % ปิด → 2 เลขที่ออกบ่อยในช่วงนั้น · เทียบเงินแบบรูดอย่างเดียวกับเลขฟันปกติ
    // รอบบ่ายไม่ใช้ (ผู้ใช้สั่ง 16 ต.ค. 69) · % ปิดงวดก่อน = แถวที่ปิดแล้วล่าสุดก่อนวันนี้
    const prevRow = history[history.length - 1];
    const prevPct = prevRow && hasClose(prevRow) && prevRow.closeValue - prevRow.closeChange ? (prevRow.closeChange / (prevRow.closeValue - prevRow.closeChange)) * 100 : null;
    const op = orHist && !manualOpen && r.openChange && !amWait ? openRangePick(orHist, r.date.toISOString().slice(0, 10), (r.openChange / (r.openValue - r.openChange)) * 100, r.openValue - r.openChange, prevPct) : null;
    const opRes = op ? { ...op, hit: closeDigits ? op.pick.filter((d) => closeDigits.includes(d)) : null, money: closeNums ? { mine: betResult(op.pick, [], closeNums[0], closeNums[1]).profit, base: betResult(pair, [], closeNums[0], closeNums[1]).profit } : null } : null;
    return { opRes, late, r, oTop, oBot, noOpenChange, fromOpen, winSetDigits, win3Hit, win2Hit, winBoth, pWin: two.win.pWin, pBoth: two.win.pBoth, pp, pairBoth, dTwo, cnDoubleLow, pick, pair, star, weak, closeDigits, hit1, hit2, hitStar, drill, drillHits, pDouble: two.pDouble, dblWatch, closeDbl, amWait };
  }).reverse();
  // คะแนนจริงของฟันช่วงท้าย เทียบกับชุดปกติ (เฉพาะวันที่บันทึกราคาช่วงท้ายไว้และผลออกแล้ว)
  const opDone = rows.filter((x) => x.opRes?.money);
  const opScore = opDone.length ? { n: opDone.length, any: opDone.filter((x) => x.opRes!.hit!.length).length, baseAny: opDone.filter((x) => x.hit2?.length).length, money: opDone.reduce((t, x) => t + x.opRes!.money!.mine, 0), baseMoney: opDone.reduce((t, x) => t + x.opRes!.money!.base, 0) } : null;
  const lateDone = rows.filter((x) => x.late?.money);
  const lateScore = lateDone.length ? { n: lateDone.length, lateAny: lateDone.filter((x) => x.late!.hit!.length).length, baseAny: lateDone.filter((x) => x.hit2?.length).length, lateMoney: lateDone.reduce((t, x) => t + x.late!.money!.late, 0), baseMoney: lateDone.reduce((t, x) => t + x.late!.money!.base, 0) } : null;

  // ราคาสดจาก Yahoo สำหรับวันที่ยังไม่ปิด (ถ้ามี) — ให้ฟันสดได้จากหน้านี้เลย
  // ราคาจาก Yahoo/BSE ของหุ้นตัวนี้ (หน้านี้มีปุ่มดึงเปิดของตัวเอง ไม่ต้องไปหน้าแรก)
  const quote = await fetchQuote(stock.symbol);
  // อียิปต์: เปิดของวันถัดไป = ปิดวันล่าสุด (ค่าเท่ากันทั้งวัน) แต่ขึ้นปุ่มเฉพาะเมื่อตลาดวันนั้นเปิดแล้วจริง ๆ
  //   ดูจากไฟล์รายนาทีของ mubasher: ถ้ามันขยับไปวันใหม่แล้ว = ตลาดเปิดแล้ว (10:00 ไคโร = 15:00 ไทย)
  const lastClosed = [...closed].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  const egyptNext = egypt && lastClosed?.closeValue != null ? egyptNextTradingDay(lastClosed.date.toISOString().slice(0, 10)) : null;
  const egyptOpened = !!egyptNext && quote?.tradingDate === egyptNext;
  const egyptNextOpen = egyptNext && egyptOpened && !stock.records.some((r) => r.date.toISOString().slice(0, 10) === egyptNext)
    ? { date: egyptNext, open: lastClosed.closeValue! } : null;
  const srcLabel = egypt ? "mubasher" : quote?.source === "bse" ? "BSE" : "Yahoo"; // ชื่อแหล่งราคาของหุ้นตัวนี้ (อียิปต์ไม่ได้ใช้ Yahoo)
  const openFromQuote = quote && !stock.records.some((r) => r.date.toISOString().slice(0, 10) === quote.tradingDate)
    ? { tradingDate: quote.tradingDate, dateLabel: new Date(quote.tradingDate).toLocaleDateString("th-TH", { day: "numeric", month: "short" }), open: quote.open, prevClose: quote.prevClose } : null;
  const liveNow = SHOW_DIRECTION && quote && !quote.closed && stock.records.some((r) => !hasClose(r)) ? { date: quote.tradingDate, source: quote.source, f: liveDirection(quote.prevClose, quote.last, quote.lastAt) } : null;

  const liveCalls = evaluateLiveCalls(stock.records);
  const calls = evaluateCalls(stock.records);
  const callByDate = new Map(calls.perDay.map((d) => [d.date.getTime(), d]));
  const paged = paginate(rows, page);
  const judged = rows.filter((x) => x.hit1 !== null);
  const hit1Count = judged.filter((x) => x.hitStar).length;
  const strong = judged.filter((x) => !x.weak), strongHit = strong.filter((x) => x.hitStar).length;
  const hit2Count = judged.filter((x) => x.hit2 && x.hit2.length > 0).length;
  const drillCount = judged.filter((x) => x.drillHits && x.drillHits.length > 0).length;
  const pending = stock.records.filter((r) => !hasClose(r)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/stocks" className="text-sm text-slate-500 hover:underline">← หุ้นทั้งหมด</Link>
          <h1 className="text-2xl font-semibold">
            {stock.symbol}
            {stock.name && <span className="ml-2 text-base font-normal text-slate-500">{stock.name}</span>}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/digits?stock=${stock.id}`} className="btn-ghost border border-slate-200">วิเคราะห์เลขปิด</Link>
          <form action={deleteStock}>
            <input type="hidden" name="id" value={stock.id} />
            <button type="submit" className="btn-danger">ลบหุ้น</button>
          </form>
        </div>
      </div>

      {/* ผลงานการฟันธง — เทียบกับสุ่มตามจำนวนเลขปิดจริงของแต่ละวัน */}
      {(() => { const sizes = judged.map((j) => j.closeDigits!.length); const rnd1 = randomAtLeastOne(sizes, 1), rnd2 = randomAtLeastOne(sizes, 2); return (
      <div className={`grid gap-4 sm:grid-cols-2 ${SHOW_DIRECTION ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <StatCard
          label="★ ตัวเด่น ถูก"
          value={judged.length ? `${hit1Count} / ${judged.length} วัน` : "-"}
          hint={judged.length ? `${Math.round((hit1Count / judged.length) * 100)}% · สุ่ม ${Math.round(rnd1 * 100)}% · ถ้าข้ามวันอ่อน ${strongHit}/${strong.length} (${strong.length ? Math.round((strongHit / strong.length) * 100) : 0}%)` : "รอผลปิดวันแรก"}
          tone={judged.length ? (hit1Count / judged.length > rnd1 ? "up" : "down") : "neutral"}
        />
        <StatCard
          label="คู่ 2 ตัว โผล่อย่างน้อย 1"
          value={judged.length ? `${hit2Count} / ${judged.length} วัน` : "-"}
          hint={judged.length ? `${Math.round((hit2Count / judged.length) * 100)}% · สุ่มเดา ${Math.round(rnd2 * 100)}%${sensex ? " · 10 ปี 63%" : ""}` : undefined}
          tone={judged.length ? (hit2Count / judged.length > rnd2 ? "up" : "down") : "neutral"}
        />
        <StatCard
          label={`เลขเจาะ (${DRILL_PER_DIGIT * 2} ตัว กลับได้) มาอย่างน้อย 1`}
          value={judged.length ? `${drillCount} / ${judged.length} วัน` : "-"}
          hint={judged.length ? `${Math.round((drillCount / judged.length) * 100)}% · สุ่มเดา ${Math.round(DRILL_BASE.dayRandom * 100)}%${sensex ? ` · 10 ปี ${Math.round(DRILL_BASE.day10y * 100)}%` : ""}` : undefined}
          tone={judged.length ? (drillCount / judged.length > DRILL_BASE.dayRandom ? "up" : "down") : "neutral"}
        />
        {SHOW_DIRECTION && <StatCard
          label="ฟันสด (ทิศทาง) ถูก"
          value={liveCalls.called ? `${liveCalls.hits} / ${liveCalls.called} วัน` : "-"}
          hint={liveCalls.called
            ? `${Math.round((liveCalls.hits / liveCalls.called) * 100)}%${liveCalls.skipped ? ` · ไม่เข้าเกณฑ์ ${liveCalls.skipped} วัน` : ""} · จากเปิด ≥${CALL_MIN_GAP_PCT}%: ${calls.hits}/${calls.called}`
            : `ยังไม่มีวันที่ฟันสดแล้วปิด · จากเปิด ≥${CALL_MIN_GAP_PCT}%: ${calls.called ? `${calls.hits}/${calls.called}` : "-"}`}
          tone={liveCalls.called ? (liveCalls.hits / liveCalls.called >= 0.85 ? "up" : "down") : "neutral"}
        />}
        <StatCard
          label="รอผลปิด"
          value={String(pending)}
          hint={pending ? "เติมค่าปิดในตารางด้านล่าง" : "ครบทุกวันแล้ว"}
        />
      </div>
      ); })()}

      {/* ปุ่มดึงเปิดของหุ้นตัวนี้ + การ์ดกรอกเปิดเอง (แถวเดียว) + ซิงก์ย้อนหลัง (พับไว้) */}
      <div className="space-y-4">
        {/* อียิปต์: วางราคาเปิดจาก investing เองได้ (เว็บเขาบล็อกการดึงอัตโนมัติ) */}
        {egypt && (() => {
          const open = stock.records.filter((r) => !hasClose(r)).sort((a, b) => b.date.getTime() - a.date.getTime())[0];
          return open ? <EgyptOpenPasteForm recordId={open.id} current={open.openValue} prevClose={Math.round((open.openValue - open.openChange) * 100) / 100} /> : null;
        })()}
        {egyptNextOpen && <EgyptOpenNextButton nextDate={egyptNextOpen.date} open={egyptNextOpen.open} />}
        {egypt && egyptNext && !egyptOpened && !stock.records.some((r) => r.date.toISOString().slice(0, 10) === egyptNext) && (
          <p className="card text-sm text-slate-500">รอตลาดไคโรเปิด (10:00 ไคโร = <b>15:00 น. ไทย</b>) แล้วปุ่มบันทึกเปิดของวัน {new Date(egyptNext).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} จะขึ้นตรงนี้</p>
        )}
        {/* รอบบ่าย ฮั่งเส็ง · จีน · นิเคอิ: กรอกเปิดเองแทนปุ่ม Yahoo (แถวรอปิด = แก้เปิด · ยังไม่มีแถว = สร้างวันใหม่จากปิดวันก่อนของ Yahoo) */}
        {manualOpen && (() => {
          const open = stock.records.filter((r) => !hasClose(r)).sort((a, b) => b.date.getTime() - a.date.getTime())[0];
          if (open) return <ManualOpenForm title={stock.symbol} stockId={stock.id} date={open.date.toISOString().slice(0, 10)} prevClose={Math.round((open.openValue - open.openChange) * 100) / 100} current={open.openValue} currentChange={open.openChange} />;
          if (openFromQuote) return <ManualOpenForm title={stock.symbol} stockId={stock.id} date={openFromQuote.tradingDate} prevClose={openFromQuote.prevClose} yahooOpen={openFromQuote.open} />;
          return <ManualOpenForm title={stock.symbol} stockId={stock.id} date={todayThai()} />; // Yahoo ยังไม่ขึ้นวันใหม่: ไม่รู้ปิดวันก่อน → กรอก +/− เอง
        })()}
        {!egyptNextOpen && openFromQuote && !manualOpen && <YahooOpenButton stockId={stock.id} symbol={stock.symbol} quote={openFromQuote} redirectTo="stock" sourceLabel={srcLabel} />}
        {/* กรอกเปิดเอง — การ์ดแถวเดียวแบบเดียวกันทุกหุ้น (รอบบ่ายฮั่งเส็ง/จีน/นิเคอิใช้การ์ดด้านบนแทน) */}
        {!manualOpen && <RecordForm stockId={stock.id} symbol={stock.symbol} today={todayThai()} />}
        {(nikkeiSession(stock.symbol) || china || hangseng || dow || isEgypt(stock.symbol)) && (
          <details className="card text-sm">
            <summary className="cursor-pointer text-blue-600">ซิงก์ย้อนหลัง</summary>
            {nikkeiSession(stock.symbol) && <NikkeiSetup />}
            {china && <ChinaSetup />}
            {hangseng && <HangSengSetup />}
            {dow && <DowJonesSetup />}
            {isEgypt(stock.symbol) && <EgyptSetup />}
          </details>
        )}
        <section className="card min-w-0 p-0">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="font-medium">ประวัติ + ผลฟันธงรายวัน</h2>
            <p className="text-xs text-slate-500">ฟันจาก D (ทศนิยมปิดวันก่อน) ไล่ทุกกรณี บน 00–99 · เหลือง = เลขที่ฟันแล้วโผล่จริง · เพดานวิธีนี้ ≈ 36%</p>
          </div>
          {opScore && <p className="mx-5 mb-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">วิธีช่วง % (ปิดงวดก่อน + เปิด → ช่วงปิด → เลขรูด) {opScore.n} วัน: เข้า {opScore.any} วัน · เงินรูด <span className={opScore.money >= 0 ? "text-emerald-700" : "text-red-700"}>{opScore.money >= 0 ? "+" : ""}{opScore.money.toLocaleString()}</span> — เลขฟันปกติวันเดียวกัน: เข้า {opScore.baseAny} วัน · เงินรูด <span className={opScore.baseMoney >= 0 ? "text-emerald-700" : "text-red-700"}>{opScore.baseMoney >= 0 ? "+" : ""}{opScore.baseMoney.toLocaleString()}</span> (รูดอย่างเดียว เลขละ 20 บาท)</p>}
          {lateScore && <p className="mx-5 mb-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">ฟันช่วงท้าย (ทดลอง) {lateScore.n} วัน: เข้า {lateScore.lateAny} วัน · เงิน <span className={lateScore.lateMoney >= 0 ? "text-emerald-700" : "text-red-700"}>{lateScore.lateMoney >= 0 ? "+" : ""}{lateScore.lateMoney.toLocaleString()}</span> — เทียบชุดปกติวันเดียวกัน: เข้า {lateScore.baseAny} วัน · เงิน <span className={lateScore.baseMoney >= 0 ? "text-emerald-700" : "text-red-700"}>{lateScore.baseMoney >= 0 ? "+" : ""}{lateScore.baseMoney.toLocaleString()}</span> (เลขละ 20 บาท)</p>}
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">ยังไม่มีข้อมูล เริ่มบันทึกเปิดได้จากฟอร์มด้านซ้าย</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">วันที่</th>
                    <th className="px-3 py-2">เลขเปิด บน / ล่าง</th>
                    {SHOW_DIRECTION && <th className="px-3 py-2">ทิศทาง</th>}
                    <th className="px-3 py-2 text-amber-800">ฟัน 2 ตัว (★ เด่น) + เจาะ</th>
                    <th className="px-3 py-2" title="วิน 3 ตัวบน 216 เลข · วิน 2 ตัว บน/ล่าง 36 เลข">วิน 6 ตัว</th>
                    <th className="px-3 py-2">ผลปิด บน / ล่าง</th>
                    <th className="px-3 py-2 text-amber-800">ผลฟัน</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.items.map(({ r, oTop, oBot, noOpenChange, fromOpen, winSetDigits, win3Hit, win2Hit, winBoth, pWin, pBoth, pp, pairBoth, dTwo, cnDoubleLow, pair, star, weak, hit1, hit2, drill, drillHits, pDouble, dblWatch, closeDbl, amWait, late, opRes }) => (
                    <tr key={r.id} className="transition hover:bg-slate-50/60">
                      <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-700">{r.date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" })}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Digits value={oTop} /> <Digits value={oBot} />
                        <div className="mt-0.5 text-xs tabular-nums text-slate-400">เปิด {fmtNum(r.openValue)} {noOpenChange ? "—" : <Change value={fromOpen ?? r.openChange} pct={fromOpen !== null ? (r.openValue ? fromOpen / r.openValue : undefined) : r.openValue - r.openChange ? r.openChange / (r.openValue - r.openChange) : undefined} className="text-xs" />}</div>
                        {!hasClose(r) && <OpenInlineEdit id={r.id} open={r.openValue} change={r.openChange} />}
                      </td>
                      {SHOW_DIRECTION && <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {/* ฟันสด (ถ้าบันทึกราคาระหว่างวันไว้) แสดงก่อน; วันที่ยังไม่ปิดและยังไม่ฟันสด → ชี้ไปหน้าแรก */}
                        {r.liveValue !== null && r.liveAt !== null && (() => {
                          const f = liveDirection(r.openValue - r.openChange, r.liveValue, r.liveAt);
                          const actual = hasClose(r) ? (r.closeChange > 0 ? "up" : r.closeChange < 0 ? "down" : "flat") : null;
                          const hit = f.call && actual ? f.call === actual : null;
                          return <div className="mb-1"><span className={`rounded px-1.5 py-0.5 font-medium ${!f.call ? "bg-slate-100 text-slate-500" : hit === true ? "bg-emerald-100 text-emerald-800" : hit === false ? "bg-red-100 text-red-800 line-through" : f.call === "up" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>สด {fmtThaiTime(r.liveAt)} <span className="tabular-nums">{fmtNum(r.liveValue)}</span> ({f.pct > 0 ? "+" : ""}{f.pct.toFixed(2)}%) {f.call === "up" ? "▲ บวก" : f.call === "down" ? "▼ ลบ" : "ไม่ฟัน"} {f.call ? `${Math.round(f.pSame * 100)}%` : ""}{hit === true ? " ✓" : hit === false ? " ✗" : ""}</span></div>;
                        })()}
                        {!hasClose(r) && liveNow && liveNow.date === r.date.toISOString().slice(0, 10) && (
                          <div className="mb-1 space-y-1">
                            <span className={`rounded px-1.5 py-0.5 font-medium ${liveNow.f.call === "up" ? "bg-emerald-100 text-emerald-800" : liveNow.f.call === "down" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>
                              {liveNow.source === "bse" ? "BSE" : "Yahoo"} {fmtThaiTime(liveNow.f.at)} {fmtNum(liveNow.f.price)} {liveNow.f.call === "up" ? "▲ บวก" : liveNow.f.call === "down" ? "▼ ลบ" : "ยังไม่ฟัน"} {Math.round(liveNow.f.pSame * 100)}% <span className="font-normal text-slate-500">({liveNow.source === "bse" ? "ดีเลย์ ~1 น." : "ดีเลย์ ~15 น."})</span>
                            </span>
                            <div><LiveSaveButton recordId={r.id} label={r.liveValue === null ? "ฟันสดด้วยราคานี้" : "อัปเดตด้วยราคานี้"} /></div>
                            {/* ช่องกรอกเอง มีไว้เฉพาะตอนได้ราคาจาก Yahoo (ดีเลย์ 15 นาที) — BSE เรียลไทม์แล้วไม่ต้อง */}
                            {liveNow.source !== "bse" && <LiveManualForm recordId={r.id} compact />}
                          </div>
                        )}
                        {/* ฟันจากเปิด (เปิดห่าง ≥1%) แสดงเฉพาะวันที่ฟันจริง — วันอื่นไม่ต้องบอกว่า "ไม่ฟัน" */}
                        {(() => { const c = callByDate.get(r.date.getTime());
                          if (!c || !c.call) return !hasClose(r) && r.liveValue === null && !liveNow
                            ? <Link href="/dashboard" className="text-blue-600 hover:underline">ฟันสดที่หน้าแรก →</Link>
                            : hasClose(r) && r.liveValue === null ? <span className="text-slate-300">–</span> : null;
                          return <span className={`rounded px-1.5 py-0.5 font-medium ${c.hit === true ? "bg-emerald-100 text-emerald-800" : c.hit === false ? "bg-red-100 text-red-800 line-through" : "bg-amber-100 text-amber-800"}`}>จากเปิด {c.call === "up" ? "▲ บวก" : "▼ ลบ"}{c.hit === true ? " ✓" : c.hit === false ? " ✗" : ""}</span>; })()}
                      </td>}
                      <td className={`px-3 py-2 whitespace-nowrap ${weak ? "bg-red-50/60" : ""}`}>
                        {weak && <span className="mb-1 block text-[10px] font-medium text-red-600">{egypt ? `วันอ่อน — ควรข้ามทั้งวัน (ข้อมูลอียิปต์ปีนี้: วันแบบนี้ 2 ตัวเข้าแค่ ${Math.round(EGYPT_2026.weakTwo * 100)}% เทียบวันปกติ ${Math.round(EGYPT_2026.okTwo * 100)}%)` : "วันอ่อน — ไม่แนะนำแทงเดี่ยว"}</span>}
                        {/* เลขฟันซ้าย · เลขเจาะขวา (เขียวเมื่อมา ตรงหรือกลับ) */}
                        {amWait ? <span className="text-xs text-amber-700">⏳ รอผลรอบเช้าเข้าระบบ (บ่ายใช้เลขเช้าด้วย)</span>
                          : <PickRow digits={pair} star={star} hit={hit2 ? hit2 : hasClose(r) ? [] : null} drill={drill} isHit={drillHits ? (m) => drillHits.includes(m) : undefined} />}
                        {!hasClose(r) && <div className="mt-2"><LateCard recordId={r.id} prevClose={r.openValue - r.openChange} saved={r.liveValue !== null && r.liveAt ? { price: r.liveValue, at: r.liveAt.toISOString() } : null} /></div>}
                        <TryRangeForm recordId={r.id} from={tryId === r.id && Number.isFinite(tryFrom) ? String(tryFrom) : ""} to={tryId === r.id && Number.isFinite(tryTo) ? String(tryTo) : ""} />
                        {tryId === r.id && !tryOk && <p className="mt-1 rounded bg-amber-50 px-1.5 py-1 text-[11px] text-amber-800"><ScrollHere />พิมพ์ช่วง % ทั้ง 2 ช่องก่อนกดวิเคราะห์ เช่น -0.7 ถึง -0.8</p>}
                        {tryId === r.id && tryOk && (
                          <div id={`try-${r.id}`} className="mt-1 scroll-mt-24 rounded bg-blue-50 px-1.5 py-1 text-[11px] text-blue-950 ring-2 ring-blue-300">
                            <ScrollHere />
                            <p>ช่วง {Math.min(tryFrom, tryTo).toFixed(2)}% ถึง {Math.max(tryFrom, tryTo).toFixed(2)}% → ดัชนีปิด ≈ {fmtNum((r.openValue - r.openChange) * (1 + Math.min(tryFrom, tryTo) / 100))} – {fmtNum((r.openValue - r.openChange) * (1 + Math.max(tryFrom, tryTo) / 100))} · {tryFrom + tryTo >= 0 ? "ปิดบวก: บน − ล่าง" : "ปิดลบ: บน + ล่าง"} = {String(Math.round((r.openValue - r.openChange) * 100) % 100).padStart(2, "0")}</p>
                            {band && <p>ในอดีตปิดช่วงนี้ {band.days} วัน · เลขออกบ่อย {band.digit.slice(0, 3).map((x) => `${x.d} (${band.days ? Math.round((100 * x.n) / band.days) : 0}%)`).join(" ")} · ออกน้อย {band.digit.slice(-2).map((x) => x.d).join(" ")} · เลข 2 ตัว {band.nums.map(([m, n]) => `${m}×${n}`).join(" ")}</p>}
                          </div>
                        )}
                        {opRes && (() => {
                          const sg = (x: number, n = 2) => `${x > 0 ? "+" : ""}${x.toFixed(n)}%`;
                          const th = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
                          return (
                            <details className="mt-1 text-[11px] text-violet-900">
                              <summary className="cursor-pointer">วิธีช่วง %: ปิดน่าจะ {sg(opRes.lo)} ถึง {sg(opRes.hi)} → รูด <span className="font-mono font-semibold">{opRes.pick.join(" ")}</span>{opRes.hit && <span className={opRes.hit.length ? "text-emerald-700" : "text-red-600"}> {opRes.hit.length ? `✓ ${opRes.hit.join(" ")}` : "✗"}</span>}{opRes.money && <span className="text-slate-400"> · {opRes.money.mine >= 0 ? "+" : ""}{opRes.money.mine.toLocaleString()} (ปกติ {opRes.money.base >= 0 ? "+" : ""}{opRes.money.base.toLocaleString()})</span>} <span className="text-violet-500 underline">ดูวิธีคิด</span></summary>
                              <ol className="mt-1 list-decimal space-y-1 rounded bg-violet-50 py-1.5 pl-6 pr-2 whitespace-normal">
                                <li>ข้อมูลก่อนปิด: ปิดงวดก่อน <b>{opRes.prevPct === null ? "—" : sg(opRes.prevPct, 4)}</b> · เปิดวันนี้ <b>{sg(opRes.openPct, 4)}</b></li>
                                <li>วันในอดีตที่ 2 ค่านี้ใกล้ที่สุด 40 วัน (5 วันแรก):
                                  <table className="mt-0.5 tabular-nums"><tbody>{opRes.similar.map((d) => <tr key={d.date}><td className="pr-2">{th(d.date)}</td><td className="pr-2">ก่อน {d.prevPct === null ? "—" : sg(d.prevPct)}</td><td className="pr-2">เปิด {sg(d.openPct)}</td><td>→ ปิด <b>{sg(d.closePct)}</b></td></tr>)}</tbody></table>
                                </li>
                                <li>เรียง % ปิดของ 40 วัน ตัดหัว 10 ท้าย 10 → ช่วงที่คาด <b>{sg(opRes.lo, 6)} ถึง {sg(opRes.hi, 6)}</b>{hasClose(r) && <> · ปิดจริง <b>{sg((r.closeChange / (r.closeValue - r.closeChange)) * 100, 6)}</b> {(() => { const a = (r.closeChange / (r.closeValue - r.closeChange)) * 100; return a >= opRes.lo && a <= opRes.hi ? "✓ อยู่ในช่วง" : "✗ นอกช่วง"; })()}</>}</li>
                                <li>แปลงเป็นราคาปิด: {fmtNum(r.openValue - r.openChange)} × (1 + %) = <b>{fmtNum(opRes.price.lo)} ถึง {fmtNum(opRes.price.hi)}</b> ({opRes.price.n.toLocaleString()} ราคา ทีละสตางค์) → เลขที่มาในราคาเหล่านี้: {opRes.price.digitRate.map((x) => `${x.d} ${(x.p * 100).toFixed(1)}%`).join(" · ")}</li>
                                <li>วันในอดีตที่ปิดอยู่ในช่วงนี้ {opRes.days} วัน → เลขที่ออก: {opRes.digitRate.map((x) => `${x.d} ${Math.round(x.p * 100)}%`).join(" · ")} → รูด 2 ตัวแรก <b className="font-mono">{opRes.pick.join(" ")}</b></li>
                              </ol>
                            </details>
                          );
                        })()}
                        {late && <div className="mt-1 text-[11px] text-slate-600">ช่วงท้าย ({late.up ? "▲" : "▼"}): <span className="font-mono font-semibold">★{late.pick[0]} {late.pick[1]}</span>{late.hit && <span className={late.hit.length ? "text-emerald-700" : "text-red-600"}> {late.hit.length ? `✓ ${late.hit.join(" ")}` : "✗"}</span>}{late.drillHit !== null && <span className={late.drillHit ? "text-amber-700" : "text-slate-400"}> · เจาะ{late.drillHit ? "เข้า" : "ไม่เข้า"}</span>}{late.money && <span className="text-slate-400"> · {late.money.late >= 0 ? "+" : ""}{late.money.late.toLocaleString()} (ปกติ {late.money.base >= 0 ? "+" : ""}{late.money.base.toLocaleString()})</span>}</div>}
                        {/* คู่ผูก (เฉพาะอียิปต์): ต้องมาครบทั้ง 2 ตัวถึงถูก — ★ วันที่โมเดลให้ ≥23.5% (ของจริง 24.6% เทียบวันอื่น 18.4%) */}
                        {pp && (
                          <span className={`mt-1.5 block text-[11px] ${pairBoth ? "font-semibold text-emerald-700" : pairBoth === false ? "text-slate-400" : "text-slate-500"}`}>
                            คู่ผูก <span className="font-mono font-bold">{pp.pair.join("-")}</span> {Math.round(pp.pBoth * 100)}%
                            {pp.pBoth >= pairStrong && <span className="ml-1 rounded bg-amber-100 px-1 font-medium text-amber-800" title={pairEvidence}>★ งวดคู่ผูกแข็ง</span>}
                            {pairBoth === true && " ✓ ครบ"}{pairBoth === false && " ✗"}
                          </span>
                        )}
                        {/* ป้ายเบิ้ลในช่องฟัน: ขึ้นเฉพาะวันที่ "ฟันว่ามีโอกาสเบิ้ล" (เลขเปิด สิบ+หน่วย = 10) หรือเตือนว่าต่ำ — วันอื่นไม่ต้องบอก */}
                        {/* จีน: ป้ายเบิ้ลจากสถิติของจีนเอง (ไม่ใช้ตัวเลขของหุ้นอื่น) */}
                        {cnDoubleLow && (
                          <span className="mt-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            <span className="font-semibold">โอกาสเบิ้ลต่ำ</span> <span className="font-normal">(D = {dTwo} เป็นเบิ้ล · สถิติจีน{pm ? "บ่าย" : "เช้า"} {Math.round((pm ? CHINA_DOUBLE.pm.dDouble : CHINA_DOUBLE.am.dDouble) * 100)}% เทียบวันอื่น {Math.round((pm ? CHINA_DOUBLE.pm.normal : CHINA_DOUBLE.am.normal) * 100)}%)</span>
                          </span>
                        )}
                        {sensex && dblWatch && pDouble >= 0.15 && (() => {
                          const sT = Number(oTop[0]) + Number(oTop[1]);
                          return <span className="mt-1.5 inline-block rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-800"><span className="font-semibold">★ มีโอกาสเบิ้ล</span> <span className="font-normal">(เปิด{sT === 10 ? `บน ${oTop[0]}+${oTop[1]}` : `ล่าง ${oBot[0]}+${oBot[1]}`} = 10 · 10 ปี ~24% — หลักฐานของ SENSEX เท่านั้น)</span></span>;
                        })()}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex gap-0.5 font-mono">{winSetDigits.map((d) => <span key={d} className="rounded bg-slate-100 px-1.5 py-0.5 text-sm font-semibold text-slate-700">{d}</span>)}</span>
                        <div className="mt-1 flex gap-1 text-[10px] leading-4" title={`วิน 3 ตัวบน 216 เลข 23% · วิน 2 ตัว บน/ล่าง 36 เลข ${Math.round(pWin * 100)}% · เข้าทั้งบนและล่าง ${Math.round(pBoth * 100)}%`}>
                          {([["3 บน", win3Hit], [win2Hit ? `2 ตัว ${win2Hit}` : "2 ตัว", win2Hit ? true : hasClose(r) ? false : null], ["บน+ล่าง", winBoth ? true : hasClose(r) ? false : null]] as const).map(([label, ok]) => (
                            <span key={String(label)} className={`rounded px-1 ${ok ? "bg-emerald-100 font-medium text-emerald-800" : ok === false ? "bg-slate-50 text-slate-400" : "bg-slate-50 text-slate-500"}`}>{ok ? "✓ " : ok === false ? "✗ " : ""}{label}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {hasClose(r) ? <>
                          <Digits value={top2(r.closeValue)} hilite={hit2 ?? []} tone="blue" /> <Digits value={bottom2(r.closeChange)} hilite={hit2 ?? []} tone="blue" />
                          <div className="mt-0.5 text-xs tabular-nums text-slate-400">ปิด {fmtNum(r.closeValue)} <Change value={r.closeChange} pct={r.closeValue - r.closeChange ? r.closeChange / (r.closeValue - r.closeChange) : undefined} className="text-xs" /></div>
                        </> : <div className="space-y-1"><CloseYahooButton recordId={r.id} label={`เติมปิดจาก ${srcLabel}`} /><CloseForm recordId={r.id} /></div>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        <HitBadge pick={[star, ...pair.filter((d) => d !== star)]} hits={hit1 === null ? null : hit2 ?? []} drillHits={drillHits} pending={hasClose(r) ? "–" : "รอผล"} />
                        {/* ผลเบิ้ล: ออกเบิ้ล → แสดงเสมอ · วันที่ฟัน "มีโอกาสเบิ้ล" แล้วไม่ออก → บอกว่าไม่เบิ้ล · วันอื่นที่ไม่ออกไม่ต้องบอก */}
                        {closeDbl && closeDbl.length > 0 && (
                          <div className="mt-1"><span className={`rounded px-2 py-0.5 font-medium ${dblWatch ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-600"}`}>เบิ้ล {closeDbl.join(" ")}{dblWatch ? " ✓ ฟันไว้" : ""}</span></div>
                        )}
                        {closeDbl && closeDbl.length === 0 && dblWatch && pDouble >= 0.15 && (
                          <div className="mt-1"><span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700" title="วันนี้ฟันว่ามีโอกาสเบิ้ล แต่ไม่ออกเบิ้ล">เบิ้ล ✗</span></div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="flex flex-col items-end gap-1">
                          <RecordEdit record={{ id: r.id, openValue: r.openValue, openChange: r.openChange, closeValue: r.closeValue, closeChange: r.closeChange }} />
                          <form action={deleteRecord}>
                            <input type="hidden" name="id" value={r.id} />
                            <button type="submit" className="text-xs text-red-600 hover:underline">ลบ</button>
                          </form>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination {...paged} href={(n) => `/stocks/${stock.id}?page=${n}`} />
            </div>
          )}
        </section>
      </div>

      <ImportForm stockId={stock.id} />

      {st.count > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-medium">สถิติราคา เปิด/ปิด (+/−)</summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <PatternMatrix summary={st} />
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="จำนวนวันที่ปิดแล้ว" value={String(st.count)} hint={`ปิดบวก ${(st.all.closeUpRate * 100).toFixed(0)}%`} />
              <StatCard label="เฉลี่ยเปลี่ยนแปลงตอนปิด" value={fmtChange(st.all.avgCloseChange)} hint={`มัธยฐาน ${fmtChange(st.all.medianCloseChange)}`} tone={st.all.avgCloseChange > 0 ? "up" : st.all.avgCloseChange < 0 ? "down" : "neutral"} />
              <StatCard label="เมื่อเปิด + → ปิดเฉลี่ย" value={st.whenOpenUp.count ? fmtChange(st.whenOpenUp.avgCloseChange) : "-"} hint={st.whenOpenUp.count ? `โอกาสปิดบวก ${(st.whenOpenUp.closeUpRate * 100).toFixed(0)}% (${st.whenOpenUp.count} ครั้ง)` : "ยังไม่มีข้อมูล"} />
              <StatCard label="เมื่อเปิด − → ปิดเฉลี่ย" value={st.whenOpenDown.count ? fmtChange(st.whenOpenDown.avgCloseChange) : "-"} hint={st.whenOpenDown.count ? `โอกาสปิดบวก ${(st.whenOpenDown.closeUpRate * 100).toFixed(0)}% (${st.whenOpenDown.count} ครั้ง)` : "ยังไม่มีข้อมูล"} />
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
