/**
 * seed-branches.mjs
 * Inserts all PSG branches from the CSV dataset into the Supabase branches table.
 *
 * Usage:
 *   node scripts/seed-branches.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '..', '.env.local');

function loadEnv(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const vars = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      vars[key] = val;
    }
    return vars;
  } catch {
    return {};
  }
}

const env = { ...loadEnv(envPath), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const branches = [
  { id: 'psg-001', name: 'PSG Jan Kemp Dorp Wealth', division: 'Wealth', province: 'Northern Cape', town: 'Jan Kempdorp', physical_address: 'Frans Lubbe Street, Jan Kempdorp, 8550', latitude: -27.9234, longitude: 24.8306 },
  { id: 'psg-002', name: 'PSG Hermanus Wealth', division: 'Wealth', province: 'Western Cape', town: 'Hermanus', physical_address: '2 Dirkie Uys Street, Hermanus, 7200', latitude: -34.4167, longitude: 19.2333 },
  { id: 'psg-003', name: 'PSG Hermanus Insure', division: 'Insure', province: 'Western Cape', town: 'Hermanus', physical_address: '2 Dirkie Uys Street, Hermanus, 7200', latitude: -34.4167, longitude: 19.2333 },
  { id: 'psg-004', name: 'PSG Yzerfontein Insure', division: 'Insure', province: 'Western Cape', town: 'Yzerfontein', physical_address: 'Main Road, Yzerfontein, 7351', latitude: -33.3422, longitude: 18.1611 },
  { id: 'psg-005', name: 'PSG Old Oak Wealth', division: 'Wealth', province: 'Western Cape', town: 'Bellville', physical_address: 'Ground Floor, White Oak Terrace, 2 Edmar Street, Old Oak Office Park, Bellville, Cape Town, 7530', latitude: -33.8742, longitude: 18.6366 },
  { id: 'psg-006', name: 'PSG Louis Trichardt Wealth Insure', division: 'Wealth Insure', province: 'Limpopo', town: 'Louis Trichardt', physical_address: 'Krogh Street, Louis Trichardt, 0920', latitude: -23.0439, longitude: 29.9042 },
  { id: 'psg-007', name: 'PSG Pretoria R21 Branch', division: 'Wealth Insure', province: 'Gauteng', town: 'Pretoria', physical_address: 'R21 Corporate Park, Nellmapius Drive, Irene, Pretoria, 0157', latitude: -25.8642, longitude: 28.2561 },
  { id: 'psg-008', name: 'PSG Wolwespruit (Victoria) Wealth Insure', division: 'Wealth Insure', province: 'Gauteng', town: 'Pretoria', physical_address: '501 Jochemus Street, Erasmuskloof, Pretoria, 0048', latitude: -25.8075, longitude: 28.2612 },
  { id: 'psg-009', name: 'PSG Somerset West Links Wealth', division: 'Wealth', province: 'Western Cape', town: 'Somerset West', physical_address: 'Somerset Links Business Park, De Beers Avenue, Somerset West, 7130', latitude: -34.0833, longitude: 18.8167 },
  { id: 'psg-010', name: 'PSG Outeniqua (George) Insure', division: 'Insure', province: 'Western Cape', town: 'George', physical_address: '101 York Street, George, 6529', latitude: -33.963, longitude: 22.4617 },
  { id: 'psg-011', name: 'PSG Melrose Arch Wealth', division: 'Wealth', province: 'Gauteng', town: 'Johannesburg', physical_address: '18 Melrose Boulevard, Melrose Arch, Johannesburg, 2076', latitude: -26.1325, longitude: 28.0673 },
  { id: 'psg-012', name: 'PSG Pretoria East Wealth', division: 'Wealth', province: 'Gauteng', town: 'Pretoria', physical_address: 'Olympus Village Centre, Olympus Drive, Pretoria East, 0081', latitude: -25.7944, longitude: 28.3283 },
  { id: 'psg-013', name: 'PSG Centurion Short Term Insure', division: 'Insure', province: 'Gauteng', town: 'Centurion', physical_address: 'Jean Avenue, Centurion, Pretoria, 0157', latitude: -25.8603, longitude: 28.1894 },
  { id: 'psg-014', name: 'PSG Umhlanga Wealth', division: 'Wealth', province: 'KwaZulu-Natal', town: 'Umhlanga', physical_address: '2 Pencarrow Crescent, La Lucia Ridge, Umhlanga, 4051', latitude: -29.7289, longitude: 31.0664 },
  { id: 'psg-015', name: 'PSG Constantia Asset', division: 'Asset', province: 'Western Cape', town: 'Cape Town', physical_address: 'Constantia Emporium, Spaanschemat River Road, Constantia, Cape Town, 7806', latitude: -34.0267, longitude: 18.4383 },
  { id: 'psg-016', name: 'PSG Tygervalley Trust', division: 'Trust', province: 'Western Cape', town: 'Bellville', physical_address: '1st Floor, Building B, Willie van Schoor Avenue, Tygervalley, Bellville, 7530', latitude: -33.8711, longitude: 18.6322 },
  { id: 'psg-017', name: 'PSG Warmbad Wealth Insure', division: 'Wealth Insure', province: 'Limpopo', town: 'Bela-Bela', physical_address: 'Chris Hani Way, Bela-Bela (Warmbad), 0480', latitude: -24.8833, longitude: 28.2833 },
  { id: 'psg-018', name: 'PSG Middelburg Insure', division: 'Insure', province: 'Mpumalanga', town: 'Middelburg', physical_address: 'Walter Sisulu Street, Middelburg, 1050', latitude: -25.7753, longitude: 29.4648 },
  { id: 'psg-019', name: 'PSG Cradock Wealth', division: 'Wealth', province: 'Eastern Cape', town: 'Cradock', physical_address: 'Church Street, Cradock, 5880', latitude: -32.1644, longitude: 25.6192 },
  { id: 'psg-020', name: 'PSG Pretoria Silverlakes Wealth', division: 'Wealth', province: 'Gauteng', town: 'Pretoria', physical_address: 'Silver Lakes Road, Hazeldean, Pretoria, 0081', latitude: -25.7667, longitude: 28.3667 },
  { id: 'psg-021', name: 'PSG Cape Town Newlands Wealth', division: 'Wealth', province: 'Western Cape', town: 'Cape Town', physical_address: 'Boundary Terraces, 1 Mariendahl Lane, Newlands, Cape Town, 7700', latitude: -33.9722, longitude: 18.4681 },
  { id: 'psg-022', name: 'PSG Hoedspruit Wealth Insure', division: 'Wealth Insure', province: 'Limpopo', town: 'Hoedspruit', physical_address: 'Huilboerboon Street, Hoedspruit, 1380', latitude: -24.3522, longitude: 30.9583 },
  { id: 'psg-023', name: 'PSG Malmesbury Wealth', division: 'Wealth', province: 'Western Cape', town: 'Malmesbury', physical_address: 'Market Street, Malmesbury, 7299', latitude: -33.4608, longitude: 18.7272 },
  { id: 'psg-024', name: 'PSG Pretoria Fintech Wealth', division: 'Wealth', province: 'Gauteng', town: 'Pretoria', physical_address: 'Lynnwood Ridge, Pretoria, 0040', latitude: -25.76, longitude: 28.29 },
  { id: 'psg-025', name: 'PSG Tygervalley Head Office', division: 'Wealth Insure', province: 'Western Cape', town: 'Bellville', physical_address: '1st Floor, Building B, 269 Willie van Schoor Avenue, Tygervalley, Bellville, 7530', latitude: -33.8711, longitude: 18.6322 },
  { id: 'psg-026', name: 'PSG Pretoria Menlyn Main (New R21 Office)', division: 'Wealth Insure', province: 'Gauteng', town: 'Pretoria', physical_address: 'Aramist Avenue, Menlyn Main, Pretoria, 0181', latitude: -25.7825, longitude: 28.2764 },
  { id: 'psg-027', name: 'PSG Pietermaritzburg Insure', division: 'Insure', province: 'KwaZulu-Natal', town: 'Pietermaritzburg', physical_address: 'Town Bush Road, Montrose, Pietermaritzburg, 3201', latitude: -29.5833, longitude: 30.35 },
  { id: 'psg-028', name: 'PSG Johannesburg Northcliff Wealth', division: 'Wealth', province: 'Gauteng', town: 'Johannesburg', physical_address: 'Beyers Naude Drive, Northcliff, Johannesburg, 2195', latitude: -26.1367, longitude: 27.9711 },
  { id: 'psg-029', name: 'PSG Johannesburg Melrose Arch', division: 'Wealth', province: 'Gauteng', town: 'Johannesburg', physical_address: '18 Melrose Boulevard, Melrose Arch, Johannesburg, 2076', latitude: -26.1325, longitude: 28.0673 },
  { id: 'psg-030', name: 'PSG Jeffreys Bay Insure', division: 'Insure', province: 'Eastern Cape', town: 'Jeffreys Bay', physical_address: 'Da Gama Road, Jeffreys Bay, 6330', latitude: -34.0506, longitude: 24.9228 },
  { id: 'psg-031', name: 'PSG Bloemhof Insure', division: 'Insure', province: 'North West', town: 'Bloemhof', physical_address: 'Prince Street, Bloemhof, 2660', latitude: -27.6469, longitude: 25.6025 },
  { id: 'psg-032', name: 'PSG Bultfontein Insure', division: 'Insure', province: 'Free State', town: 'Bultfontein', physical_address: 'Pres Swart Street, Bultfontein, 9670', latitude: -28.2833, longitude: 26.15 },
  { id: 'psg-033', name: 'PSG Johannesburg Rittendale Wealth', division: 'Wealth', province: 'Gauteng', town: 'Johannesburg', physical_address: 'Rivonia Road, Morningside, Sandton, Johannesburg, 2196', latitude: -26.0711, longitude: 28.0611 },
  { id: 'psg-034', name: 'PSG Pretoria Global House Wealth', division: 'Wealth', province: 'Gauteng', town: 'Pretoria', physical_address: 'Global House, Brooklyn, Pretoria, 0181', latitude: -25.7711, longitude: 28.2333 },
  { id: 'psg-035', name: 'PSG Wredevallei (Worcester) Wealth Insure', division: 'Wealth Insure', province: 'Western Cape', town: 'Worcester', physical_address: 'High Street, Worcester, 6850', latitude: -33.6478, longitude: 19.4447 },
  { id: 'psg-036', name: 'PSG Stellenbosch Dorp Straat Wealth', division: 'Wealth', province: 'Western Cape', town: 'Stellenbosch', physical_address: 'Dorp Street, Stellenbosch, 7600', latitude: -33.9386, longitude: 18.8594 },
  { id: 'psg-037', name: 'PSG Constantia Asset', division: 'Asset', province: 'Western Cape', town: 'Cape Town', physical_address: 'Constantia Emporium, Spaanschemat River Road, Constantia, Cape Town, 7806', latitude: -34.0267, longitude: 18.4383 },
  { id: 'psg-038', name: 'PSG De Anker Wealth Insure', division: 'Wealth Insure', province: 'Free State', town: 'Bloemfontein', physical_address: 'Nelson Mandela Drive, Bloemfontein, 9301', latitude: -29.1167, longitude: 26.2167 },
  { id: 'psg-039', name: 'PSG Pietermaritzburg Finance House Wealth Insure', division: 'Wealth Insure', province: 'KwaZulu-Natal', town: 'Pietermaritzburg', physical_address: 'Victoria Road, Pietermaritzburg, 3201', latitude: -29.6, longitude: 30.38 },
  { id: 'psg-040', name: 'PSG Pretoria Olympus Insure', division: 'Insure', province: 'Gauteng', town: 'Pretoria', physical_address: 'Olympus Drive, Pretoria East, 0081', latitude: -25.7944, longitude: 28.3283 },
  { id: 'psg-041', name: 'PSG Plettenberg Bay Olympus Insure', division: 'Insure', province: 'Western Cape', town: 'Plettenberg Bay', physical_address: 'Main Street, Plettenberg Bay, 6600', latitude: -34.0528, longitude: 23.3717 },
  { id: 'psg-042', name: 'PSG George Olympus Insure', division: 'Insure', province: 'Western Cape', town: 'George', physical_address: 'York Street, George, 6529', latitude: -33.963, longitude: 22.4617 },
  { id: 'psg-043', name: 'PSG Knysna Olympus Insure', division: 'Insure', province: 'Western Cape', town: 'Knysna', physical_address: 'Main Road, Knysna, 6570', latitude: -34.0363, longitude: 23.0471 },
  { id: 'psg-044', name: 'PSG Johannesburg Hyde Park Wealth', division: 'Wealth', province: 'Gauteng', town: 'Johannesburg', physical_address: 'Hyde Park Lane, Jan Smuts Avenue, Hyde Park, Johannesburg, 2196', latitude: -26.1242, longitude: 28.0375 },
];

async function seedBranches() {
  console.log(`Seeding ${branches.length} branches...`);

  const { data, error } = await supabase
    .from('branches')
    .upsert(branches, { onConflict: 'id' })
    .select('id, name');

  if (error) {
    console.error('Failed to seed branches:', error.message);
    process.exit(1);
  }

  console.log(`Successfully seeded ${data.length} branches:`);
  data.forEach((b) => console.log(`  ✓ ${b.id} — ${b.name}`));
}

seedBranches();
