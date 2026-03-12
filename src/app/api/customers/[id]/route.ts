import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

const PhoneSchema = z
  .string()
  .min(1, 'Phone is required')
  .regex(/^\d+$/, 'Phone must contain numbers only');

const UpdateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  postcode: z.string().min(1).optional(),
  phone: PhoneSchema.optional(),
  kodKV: z.string().min(1).optional(),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  return NextResponse.json({ customer });
}

export async function PATCH(request: Request, { params }: Params) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = UpdateCustomerSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: 'No fields to update' },
      { status: 400 }
    );
  }

  if (data.phone) {
    const existingPhone = await prisma.customer.findFirst({
      where: {
        phone: data.phone,
        id: { not: id },
      },
      select: { id: true },
    });

    if (existingPhone) {
      return NextResponse.json(
        { error: 'No Phone telah diguna' },
        { status: 409 }
      );
    }
  }

  try {
    const customer = await prisma.customer.update({
      where: { id },
      data,
    });

    return NextResponse.json({ customer });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
