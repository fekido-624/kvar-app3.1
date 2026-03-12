type ReceiptTemplatePreviewProps = {
  noResit: string;
  noSeriSebatHarga: string;
  tarikh: string;
  namaPenerima: string;
  namaKolejVokasional: string;
  perkara: string;
  tajuk: string;
  kuantiti: number;
  hargaSeunit: number;
  hargaPostage: number;
  jumlah: number;
};

const formatCurrency = (value: number) => value.toFixed(2);

const formatDate = (value: string) => {
  if (!value) return '__/__/____';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB');
};

const uppercaseOrPlaceholder = (value: string, placeholder: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : placeholder;
};

type ReceiptSectionPreviewProps = {
  documentLabel: string;
  noSiri: string;
  tarikh: string;
  namaPenerima: string;
  namaKolejVokasional: string;
  heading: string;
  perkara: string;
  kuantiti: number;
  hargaSeunit: number;
  hargaPostage: number;
  jumlah: number;
};

function ReceiptSectionPreview({
  documentLabel,
  noSiri,
  tarikh,
  namaPenerima,
  namaKolejVokasional,
  heading,
  perkara,
  kuantiti,
  hargaSeunit,
  hargaPostage,
  jumlah,
}: ReceiptSectionPreviewProps) {
  const itemLabel = uppercaseOrPlaceholder(perkara, 'PERKARA RESIT');
  const recipient = uppercaseOrPlaceholder(namaPenerima, 'NAMA PENERIMA');
  const college = uppercaseOrPlaceholder(namaKolejVokasional, 'KOLEJ VOKASIONAL');
  const sectionHeading = uppercaseOrPlaceholder(heading, 'TAJUK DOKUMEN AKAN MUNCUL DI SINI');
  const subtotal = kuantiti * hargaSeunit;

  return (
    <section style={{ fontFamily: 'Calibri, Arial, sans-serif' }} className="flex h-full flex-col justify-between text-[10px] leading-tight text-black">
      <div>
        <div className="mb-5 flex items-start justify-between gap-6">
          <div className="max-w-[210px] space-y-1">
            <h2 className="text-[15px] font-bold tracking-tight">IZOTECH ENTERPRISE</h2>
            <div className="text-[9px] font-bold uppercase leading-[1.35]">
              <div>LOT 800 &amp; 801</div>
              <div>JLN TENGKU MOHD MA&apos;ASUM</div>
              <div>15150 KOTA BHARU</div>
              <div>KELANTAN.</div>
            </div>
          </div>

          <div className="min-w-[150px] pt-4 text-[10px] font-bold">
            <div className="mb-2 text-center text-[13px] tracking-wide uppercase">{documentLabel}</div>
            <div className="grid grid-cols-[32px_1fr_54px] gap-y-1">
              <div>NO</div>
              <div></div>
              <div className="text-right">{noSiri || '0000'}</div>
              <div>Tarikh</div>
              <div></div>
              <div className="text-right">{formatDate(tarikh)}</div>
            </div>
          </div>
        </div>

        <div className="mb-5 space-y-1 text-[10px] font-bold uppercase">
          <div>{recipient}</div>
          <div>{college}</div>
        </div>

        <div className="mb-3 text-[10px] font-bold uppercase">{sectionHeading}</div>

        <table className="mb-4 w-full border-collapse border border-black text-[9px]">
          <thead>
            <tr className="bg-neutral-100 text-center font-bold uppercase">
              <th className="border border-black px-1 py-1">Perkara</th>
              <th className="w-[52px] border border-black px-1 py-1">Unit</th>
              <th className="w-[80px] border border-black px-1 py-1">Harga Seunit</th>
              <th className="w-[54px] border border-black px-1 py-1">Jumlah (RM)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="h-[82px] border border-black px-1 align-top uppercase">{itemLabel}</td>
              <td className="border border-black px-1 pt-5 text-center align-top">{kuantiti || 0}</td>
              <td className="border border-black px-1 pt-5 text-center align-top">{formatCurrency(hargaSeunit)}</td>
              <td className="border border-black px-1 pt-5 text-right align-top">{formatCurrency(subtotal)}</td>
            </tr>
            <tr>
              <td className="border border-black px-1 py-4 align-top">Bayaran Pos</td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black px-1 py-4 text-right align-top">{formatCurrency(hargaPostage)}</td>
            </tr>
            <tr className="bg-neutral-100 font-bold uppercase">
              <td colSpan={3} className="border border-black px-1 py-1 text-right">Grand Total</td>
              <td className="border border-black px-1 py-1 text-right">{formatCurrency(jumlah)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="space-y-2 text-[9px]">
        <div className="font-bold">Notes :</div>
        <div>
          1. All cheque should be crossed and made payable to IZOTECH ENTERPRISE (AFFIN BANK: 105180075782)
        </div>
      </div>
    </section>
  );
}

export function ReceiptTemplatePreview({
  noResit,
  noSeriSebatHarga,
  tarikh,
  namaPenerima,
  namaKolejVokasional,
  perkara,
  tajuk,
  kuantiti,
  hargaSeunit,
  hargaPostage,
  jumlah,
}: ReceiptTemplatePreviewProps) {
  const resitHeading = perkara || tajuk;
  const sebutHargaHeading = tajuk || 'SEBUT HARGA BAGI MEMBEKALKAN MODUL BAHASA MELAYU SEMESTER 1';

  return (
    <div className="receipt-print-root overflow-x-auto rounded-xl border bg-slate-200/60 p-3 md:p-6 print:overflow-visible print:border-0 print:bg-white print:p-0">
      <div className="receipt-print-sheet mx-auto w-full max-w-[210mm] bg-white text-black shadow-[0_8px_30px_rgba(15,23,42,0.16)] print:shadow-none">
        <div className="flex h-[277mm] flex-col">
          <div className="flex-1 overflow-hidden">
            <ReceiptSectionPreview
              documentLabel="Invois"
              noSiri={noResit}
              tarikh={tarikh}
              namaPenerima={namaPenerima}
              namaKolejVokasional={namaKolejVokasional}
              heading={resitHeading}
              perkara={perkara}
              kuantiti={kuantiti}
              hargaSeunit={hargaSeunit}
              hargaPostage={hargaPostage}
              jumlah={jumlah}
            />
          </div>

          <div className="relative py-[2mm] text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-neutral-400"></div>
            <span className="relative bg-white px-3">Potong</span>
          </div>

          <div className="flex-1 overflow-hidden">
            <ReceiptSectionPreview
              documentLabel="Sebut Harga"
              noSiri={noSeriSebatHarga}
              tarikh={tarikh}
              namaPenerima={namaPenerima}
              namaKolejVokasional={namaKolejVokasional}
              heading={sebutHargaHeading}
              perkara={perkara}
              kuantiti={kuantiti}
              hargaSeunit={hargaSeunit}
              hargaPostage={hargaPostage}
              jumlah={jumlah}
            />
          </div>
        </div>
      </div>
    </div>
  );
}