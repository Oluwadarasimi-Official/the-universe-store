-- Starter categories (real structure, editable) + clearly-labelled DEMO products/guide.
-- Demo rows have is_demo = true, no prices, no stock, no ratings, no links, no images.
-- Remove them in one click: Admin → Settings → Demo data → Remove all demo data.
insert into universe_store.categories (slug, name, intro, sort_order) values
 ('electronics','Electronics','Phones, audio, chargers and everyday tech accessories.',10),
 ('home-and-kitchen','Home & Kitchen','Practical tools and small appliances for cooking, cleaning and living.',20),
 ('fashion','Fashion','Clothing, footwear and bags for everyday wear.',30),
 ('beauty-and-personal-care','Beauty & Personal Care','Grooming, skincare and personal-care essentials.',40),
 ('lifestyle','Lifestyle','Fitness, travel and hobby finds.',50),
 ('accessories','Accessories','Watches, wallets, phone cases and finishing touches.',60),
 ('books-and-learning','Books & Learning','Books, stationery and learning tools.',70),
 ('everyday-essentials','Everyday Essentials','Household basics worth keeping in stock.',80)
on conflict (slug) do nothing;

with d(cat, slug, title, feat) as (values
 ('electronics','demo-wireless-earbuds','Demo: Wireless Earbuds (sample listing)',true),
 ('electronics','demo-20-000mah-power-bank','Demo: 20,000mAh Power Bank (sample listing)',true),
 ('home-and-kitchen','demo-electric-kettle-1-7l','Demo: Electric Kettle 1.7L (sample listing)',true),
 ('home-and-kitchen','demo-non-stick-frying-pan','Demo: Non-stick Frying Pan (sample listing)',true),
 ('fashion','demo-everyday-canvas-sneakers','Demo: Everyday Canvas Sneakers (sample listing)',false),
 ('beauty-and-personal-care','demo-rechargeable-hair-clipper','Demo: Rechargeable Hair Clipper (sample listing)',false),
 ('books-and-learning','demo-a5-ruled-notebook-set','Demo: A5 Ruled Notebook Set (sample listing)',false),
 ('accessories','demo-slim-card-wallet','Demo: Slim Card Wallet (sample listing)',false))
insert into universe_store.products (slug,title,short_description,full_description,category_id,retailer_name,is_demo,editorial_status,featured_flag,source_notes,published_at)
select d.slug, d.title, 'Sample product used to preview the layout. Not a real offer.',
 'This is demo content. It shows how a product page will look once real, owner-verified products are added. It has no price, stock information or retailer link on purpose.',
 c.id, 'Jumia', true, 'published', d.feat, 'DEMO DATA — remove before launch (Settings → Demo data).', now()
from d join universe_store.categories c on c.slug = d.cat
on conflict (slug) do nothing;

insert into universe_store.guides (slug,kind,title,excerpt,body,selection_criteria,limitations,product_ids,status,is_demo,published_at)
select 'demo-how-we-choose-products','guide','Demo guide: How we choose products','Sample guide showing the guide layout. Replace with your own reviewed guides.',
E'## What we look for\n\n- Clear, verifiable product information from the retailer listing\n- Useful features for everyday buyers in Nigeria and abroad\n- Retailers with clear pricing, delivery and returns information\n\n## What we don''t do\n\nWe don''t invent ratings, reviews, prices or discounts, and we don''t claim to have tested products unless we say so with evidence.',
'Demo: products are chosen for usefulness and the quality of the information available about them.',
'Demo content. No products here have been tested hands-on.',
(select coalesce(array_agg(id),'{}') from (select id from universe_store.products where is_demo limit 4) x), 'published', true, now()
on conflict (slug) do nothing;
