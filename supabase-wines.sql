-- ============================================================
-- Miles Mossop wine catalogue - real cellar-door prices
-- Source: SA Cellar Door Price List, valid 1 Mar 2026 - 28 Feb 2027.
-- Safe to re-run. Adds columns, then refreshes the Miles range.
-- Your own 'other' producer wines (if any) are left untouched.
-- NOTE: cost_price is left at 0 on purpose - the retail list has no
-- trade/cost figure. Fill in your cost per bottle in the Box Builder
-- (or here) so the profit numbers are real.
-- ============================================================

alter table wines add column if not exists range    text;
alter table wines add column if not exists format   text default '750ml';
alter table wines add column if not exists note     text;
alter table wines add column if not exists position int default 0;

-- Refresh Miles's range (replaces the old placeholders)
delete from wines where producer = 'miles';

insert into wines (producer, range, name, vintage, format, cellar_price, cost_price, note, active, position) values
('miles','The Family',       'Sam',                                       '2021','750ml',1065, 0, 'On allocation / request', true, 1),
('miles','The Family',       'Max',                                       '2021','750ml', 495, 0, null, true, 2),
('miles','The Family',       'Max',                                       '2020','1.5L', 1235, 0, null, true, 3),
('miles','The Family',       'Max',                                       '2020','3.0L', 2565, 0, null, true, 4),
('miles','The Family',       'Max',                                       '2020','5.0L', 4275, 0, null, true, 5),
('miles','The Family',       'Max',                                       '2020','9.0L', 7700, 0, null, true, 6),
('miles','The Family',       'Saskia',                                    '2022','750ml', 380, 0, null, true, 7),
('miles','The Family',       'Kika',                                      '2025','375ml', 515, 0, null, true, 8),
('miles','The Family',       'Tony''s Cape Vintage Reserve',              '2021','375ml', 360, 0, null, true, 9),
('miles','The Introduction', 'Introduction Red',                          '2023','750ml', 215, 0, null, true, 10),
('miles','The Introduction', 'Introduction Chenin Blanc',                 '2024','750ml', 190, 0, null, true, 11),
('miles','The Chapters',     'Chapter One Swartland Cinsault',            '2022','750ml', 330, 0, null, true, 12),
('miles','The Chapters',     'Chapters Stellenbosch Chenin Blanc',        '2023','750ml', 330, 0, null, true, 13),
('miles','The Chapters',     'Chapters Stellenbosch Sauvignon Blanc',     '2023','750ml', 330, 0, null, true, 14),
('miles','The Chapters',     'Chapters Stellenbosch Cabernet Sauvignon',  '2022','750ml', 365, 0, null, true, 15);
