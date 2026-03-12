import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

const PhoneSchema = z
  .string()
  .min(1, 'Phone is required')
  .regex(/^\d+$/, 'Phone must contain numbers only');

const CreateCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  postcode: z.string().min(1, 'Postcode is required'),
  phone: PhoneSchema,
  kodKV: z.string().min(1, 'Kod KV is required'),
});

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function GET() {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ customers });
}

export async function POST(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = CreateCustomerSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const existingPhone = await prisma.customer.findFirst({
    where: { phone: data.phone },
    select: { id: true },
  });

  if (existingPhone) {
    return NextResponse.json(
      { error: 'No Phone telah diguna' },
      { status: 409 }
    );
  }

  const customer = await prisma.customer.create({
    data: {
      name: data.name,
      address: data.address,
      postcode: data.postcode,
      phone: data.phone,
      kodKV: data.kodKV,
    },
  });

  return NextResponse.json({ customer }, { status: 201 });
}

export async function DELETE(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = BulkDeleteSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload. Expected ids: string[]' },
      { status: 400 }
    );
  }

  const { ids } = parsed.data;
  const result = await prisma.customer.deleteMany({
    where: {
      id: { in: ids },
    },
  });

  return NextResponse.json({ deletedCount: result.count });
}
