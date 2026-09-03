export async function GET() {
  // BOM keeps Hebrew headers legible when the file is opened directly in Excel.
  const csv = '\uFEFFשם המוזמן,מספר טלפון,צד\r\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="guest-template.csv"',
    },
  });
}
