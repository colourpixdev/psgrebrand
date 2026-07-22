alter table public.branches alter column id type text using id::text;
alter table public.branches alter column id set default (gen_random_uuid()::text);

alter table public.branches add column if not exists province text;
alter table public.branches add column if not exists town text;
alter table public.branches add column if not exists physical_address text;
alter table public.branches add column if not exists latitude double precision;
alter table public.branches add column if not exists longitude double precision;
alter table public.branches add column if not exists contact_name text;
alter table public.branches add column if not exists contact_email text;
alter table public.branches add column if not exists contact_phone text;
alter table public.branches add column if not exists created_at timestamptz not null default now();
alter table public.branches add column if not exists updated_at timestamptz not null default now();

insert into public.branches (
  id,
  name,
  division,
  province,
  town,
  physical_address,
  latitude,
  longitude
)
values
  ('psg-001','PSG Jan Kemp Dorp Wealth','Wealth','Northern Cape','Jan Kempdorp','Frans Lubbe Street, Jan Kempdorp, 8550',-27.9234,24.8306),
  ('psg-002','PSG Hermanus Wealth','Wealth','Western Cape','Hermanus','2 Dirkie Uys Street, Hermanus, 7200',-34.4167,19.2333),
  ('psg-003','PSG Hermanus Insure','Insure','Western Cape','Hermanus','2 Dirkie Uys Street, Hermanus, 7200',-34.4167,19.2333),
  ('psg-004','PSG Yzerfontein Insure','Insure','Western Cape','Yzerfontein','Main Road, Yzerfontein, 7351',-33.3422,18.1611),
  ('psg-005','PSG Old Oak Wealth','Wealth','Western Cape','Bellville','Ground Floor, White Oak Terrace, 2 Edmar Street, Old Oak Office Park, Bellville, Cape Town, 7530',-33.8742,18.6366),
  ('psg-006','PSG Louis Trichardt Wealth Insure','Wealth Insure','Limpopo','Louis Trichardt','Krogh Street, Louis Trichardt, 0920',-23.0439,29.9042),
  ('psg-007','PSG Pretoria R21 Branch','Wealth Insure','Gauteng','Pretoria','R21 Corporate Park, Nellmapius Drive, Irene, Pretoria, 0157',-25.8642,28.2561),
  ('psg-008','PSG Wolwespruit (Victoria) Wealth Insure','Wealth Insure','Gauteng','Pretoria','501 Jochemus Street, Erasmuskloof, Pretoria, 0048',-25.8075,28.2612),
  ('psg-009','PSG Somerset West Links Wealth','Wealth','Western Cape','Somerset West','Somerset Links Business Park, De Beers Avenue, Somerset West, 7130',-34.0833,18.8167),
  ('psg-010','PSG Outeniqua (George) Insure','Insure','Western Cape','George','101 York Street, George, 6529',-33.963,22.4617),
  ('psg-011','PSG Melrose Arch Wealth','Wealth','Gauteng','Johannesburg','18 Melrose Boulevard, Melrose Arch, Johannesburg, 2076',-26.1325,28.0673),
  ('psg-012','PSG Pretoria East Wealth','Wealth','Gauteng','Pretoria','Olympus Village Centre, Olympus Drive, Pretoria East, 0081',-25.7944,28.3283),
  ('psg-013','PSG Centurion Short Term Insure','Insure','Gauteng','Centurion','Jean Avenue, Centurion, Pretoria, 0157',-25.8603,28.1894),
  ('psg-014','PSG Umhlanga Wealth','Wealth','KwaZulu-Natal','Umhlanga','2 Pencarrow Crescent, La Lucia Ridge, Umhlanga, 4051',-29.7289,31.0664),
  ('psg-015','PSG Constantia Asset','Asset','Western Cape','Cape Town','Constantia Emporium, Spaanschemat River Road, Constantia, Cape Town, 7806',-34.0267,18.4383),
  ('psg-016','PSG Tygervalley Trust','Trust','Western Cape','Bellville','1st Floor, Building B, Willie van Schoor Avenue, Tygervalley, Bellville, 7530',-33.8711,18.6322),
  ('psg-017','PSG Warmbad Wealth Insure','Wealth Insure','Limpopo','Bela-Bela','Chris Hani Way, Bela-Bela (Warmbad), 0480',-24.8833,28.2833),
  ('psg-018','PSG Middelburg Insure','Insure','Mpumalanga','Middelburg','Walter Sisulu Street, Middelburg, 1050',-25.7753,29.4648),
  ('psg-019','PSG Cradock Wealth','Wealth','Eastern Cape','Cradock','Church Street, Cradock, 5880',-32.1644,25.6192),
  ('psg-020','PSG Pretoria Silverlakes Wealth','Wealth','Gauteng','Pretoria','Silver Lakes Road, Hazeldean, Pretoria, 0081',-25.7667,28.3667),
  ('psg-021','PSG Cape Town Newlands Wealth','Wealth','Western Cape','Cape Town','Boundary Terraces, 1 Mariendahl Lane, Newlands, Cape Town, 7700',-33.9722,18.4681),
  ('psg-022','PSG Hoedspruit Wealth Insure','Wealth Insure','Limpopo','Hoedspruit','Huilboerboon Street, Hoedspruit, 1380',-24.3522,30.9583),
  ('psg-023','PSG Malmesbury Wealth','Wealth','Western Cape','Malmesbury','Market Street, Malmesbury, 7299',-33.4608,18.7272),
  ('psg-024','PSG Pretoria Fintech Wealth','Wealth','Gauteng','Pretoria','Lynnwood Ridge, Pretoria, 0040',-25.76,28.29),
  ('psg-025','PSG Tygervalley Head Office','Wealth Insure','Western Cape','Bellville','1st Floor, Building B, 269 Willie van Schoor Avenue, Tygervalley, Bellville, 7530',-33.8711,18.6322),
  ('psg-026','PSG Pretoria Menlyn Main (New R21 Office)','Wealth Insure','Gauteng','Pretoria','Aramist Avenue, Menlyn Main, Pretoria, 0181',-25.7825,28.2764),
  ('psg-027','PSG Pietermaritzburg Insure','Insure','KwaZulu-Natal','Pietermaritzburg','Town Bush Road, Montrose, Pietermaritzburg, 3201',-29.5833,30.35),
  ('psg-028','PSG Johannesburg Northcliff Wealth','Wealth','Gauteng','Johannesburg','Beyers Naude Drive, Northcliff, Johannesburg, 2195',-26.1367,27.9711),
  ('psg-029','PSG Johannesburg Melrose Arch','Wealth','Gauteng','Johannesburg','18 Melrose Boulevard, Melrose Arch, Johannesburg, 2076',-26.1325,28.0673),
  ('psg-030','PSG Jeffreys Bay Insure','Insure','Eastern Cape','Jeffreys Bay','Da Gama Road, Jeffreys Bay, 6330',-34.0506,24.9228),
  ('psg-031','PSG Bloemhof Insure','Insure','North West','Bloemhof','Prince Street, Bloemhof, 2660',-27.6469,25.6025),
  ('psg-032','PSG Bultfontein Insure','Insure','Free State','Bultfontein','Pres Swart Street, Bultfontein, 9670',-28.2833,26.15),
  ('psg-033','PSG Johannesburg Rittendale Wealth','Wealth','Gauteng','Johannesburg','Rivonia Road, Morningside, Sandton, Johannesburg, 2196',-26.0711,28.0611),
  ('psg-034','PSG Pretoria Global House Wealth','Wealth','Gauteng','Pretoria','Global House, Brooklyn, Pretoria, 0181',-25.7711,28.2333),
  ('psg-035','PSG Wredevallei (Worcester) Wealth Insure','Wealth Insure','Western Cape','Worcester','High Street, Worcester, 6850',-33.6478,19.4447),
  ('psg-036','PSG Stellenbosch Dorp Straat Wealth','Wealth','Western Cape','Stellenbosch','Dorp Street, Stellenbosch, 7600',-33.9386,18.8594),
  ('psg-038','PSG De Anker Wealth Insure','Wealth Insure','Free State','Bloemfontein','Nelson Mandela Drive, Bloemfontein, 9301',-29.1167,26.2167),
  ('psg-039','PSG Pietermaritzburg Finance House Wealth Insure','Wealth Insure','KwaZulu-Natal','Pietermaritzburg','Victoria Road, Pietermaritzburg, 3201',-29.6,30.38),
  ('psg-040','PSG Pretoria Olympus Insure','Insure','Gauteng','Pretoria','Olympus Drive, Pretoria East, 0081',-25.7944,28.3283),
  ('psg-041','PSG Plettenberg Bay Olympus Insure','Insure','Western Cape','Plettenberg Bay','Main Street, Plettenberg Bay, 6600',-34.0528,23.3717),
  ('psg-042','PSG George Olympus Insure','Insure','Western Cape','George','York Street, George, 6529',-33.963,22.4617),
  ('psg-043','PSG Knysna Olympus Insure','Insure','Western Cape','Knysna','Main Road, Knysna, 6570',-34.0363,23.0471),
  ('psg-044','PSG Johannesburg Hyde Park Wealth','Wealth','Gauteng','Johannesburg','Hyde Park Lane, Jan Smuts Avenue, Hyde Park, Johannesburg, 2196',-26.1242,28.0375)
on conflict (id)
do update set
  name = excluded.name,
  division = excluded.division,
  province = excluded.province,
  town = excluded.town,
  physical_address = excluded.physical_address,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  updated_at = now();
