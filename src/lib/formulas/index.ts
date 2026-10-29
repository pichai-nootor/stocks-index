/**
 * ทะเบียนสูตรต่อตลาด — เพิ่มตลาดใหม่ = เพิ่มไฟล์ formulas/<ตลาด>.ts แล้วลงทะเบียนตรงนี้ (สูตรของใครของมัน ไม่กระทบกัน)
 * ตลาดที่ยังไม่มีไฟล์ของตัวเองใช้สูตรทั่วไปจาก formulas/vip.ts (เลขร้อน + ทดลองจากตัวเปิด)
 */
import type { MarketFormula } from "./types";
import { genericFormula } from "./vip";
import { cnFormula } from "./cn";
import { hkFormula } from "./hk";
import { krFormula } from "./kr";
import { inFormula } from "./in";
import { jpFormula } from "./jp";
import { twFormula } from "./tw";
import { sgFormula } from "./sg";
import { ukFormula } from "./uk";
import { deFormula } from "./de";
import { ruFormula } from "./ru";

const registry: Record<string, MarketFormula> = {
  in: inFormula,
  cn: cnFormula,
  hk: hkFormula,
  kr: krFormula,
  jp: jpFormula,
  tw: twFormula,
  sg: sgFormula,
  uk: ukFormula,
  de: deFormula,
  ru: ruFormula,
};

export const formulaFor = (market: string): MarketFormula => registry[market] ?? genericFormula;
export const hasOwnFormula = (market: string) => market in registry;
