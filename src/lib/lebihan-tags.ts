import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1, 'Maklumat ini diperlukan.').max(max);

export const lebihanTagSchema = z.object({
  noOrder: text(80),
  name: text(160),
  kv: text(160),
  address: text(600),
  postcode: text(20),
  phone: text(60),
  lebihan: z.number().int().min(0).max(1000000),
  naskahGuru: z.number().int().min(0).max(1000000),
  sourceType: z.enum(['manual', 'parcel', 'customer', 'tempahan']).default('manual'),
  sourceId: z.string().max(100).default(''),
}).refine((tag) => tag.lebihan > 0 || tag.naskahGuru > 0, {
  message: 'Isi sekurang-kurangnya satu kuantiti melebihi 0.',
  path: ['lebihan'],
});

export type LebihanTagInput = z.infer<typeof lebihanTagSchema>;
export type LebihanTagRecord = LebihanTagInput & {
  id: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type TagPreviewPage = {
  width: number;
  height: number;
  margin: number;
  frame: { x1: number; y1: number; x2: number; y2: number; thickness: number }[];
  lines: { text: string; x: number; y: number; size: number; bold: boolean }[];
};

export const tagIdsSchema = z.array(z.string().min(1).max(100)).min(1).max(200)
  .transform((ids) => [...new Set(ids)]);
