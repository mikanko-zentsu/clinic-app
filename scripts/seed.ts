import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ibdhcyvridkliivwquxi.supabase.co',
  'sb_publishable_rUXidQJDGZaCPOo9T9a_Qw_ypLc-hvn'
);

async function seed() {
  // 既存データを全件削除
  const { error: deleteStaffError } = await supabase.from('staff').delete().neq('id', 0);
  if (deleteStaffError) console.error('staff delete error:', deleteStaffError);
  else console.log('staff削除完了');

  const { error: deletePatientsError } = await supabase.from('patients').delete().neq('id', 0);
  if (deletePatientsError) console.error('patients delete error:', deletePatientsError);
  else console.log('patients削除完了');

  // staffデータを挿入
  const { error: staffError } = await supabase.from('staff').insert([
    { name: '田中 誠', role: '院長', color: '#0d9488' },
    { name: '鈴木 由美', role: '副院長', color: '#7c3aed' },
    { name: '佐藤 健', role: 'スタッフ', color: '#ea580c' },
  ]);
  if (staffError) console.error('staff error:', staffError);
  else console.log('staff挿入完了');

  // patientsデータを挿入
  const { error: patientsError } = await supabase.from('patients').insert([
    { card_id: '00001', name: '山田 太郎', kana: 'やまだ たろう', dob: '1985年3月12日', gender: '男性', zip: '160-0023', phone: '090-1234-5678', address: '東京都新宿区西新宿1-1-1', notes: '腰痛・定期施術' },
    { card_id: '00002', name: '鈴木 花子', kana: 'すずき はなこ', dob: '1990年7月24日', gender: '女性', zip: '150-0043', phone: '080-9876-5432', address: '東京都渋谷区道玄坂2-3-4', notes: '肩こり・週1回通院' },
    { card_id: '00003', name: '佐藤 次郎', kana: 'さとう じろう', dob: '1978年11月3日', gender: '男性', zip: '171-0014', phone: '070-1111-2222', address: '東京都豊島区池袋3-5-7', notes: '頸部痛' },
    { card_id: '10234', name: '高橋 一郎', kana: 'たかはし いちろう', dob: '1965年5月20日', gender: '男性', zip: '133-0061', phone: '090-3333-4444', address: '東京都江戸川区篠崎4-2-1', notes: '' },
    { card_id: '12345', name: '鈴木 一郎', kana: 'すずき いちろう', dob: '1972年9月15日', gender: '男性', zip: '231-0005', phone: '080-5555-6666', address: '神奈川県横浜市中区1-2-3', notes: 'ぎっくり腰・急性期' },
    { card_id: '20018', name: '伊藤 美咲', kana: 'いとう みさき', dob: '1995年2月14日', gender: '女性', zip: '330-0063', phone: '090-7777-8888', address: '埼玉県さいたま市浦和区2-4-6', notes: '膝痛・スポーツ障害' },
    { card_id: '30451', name: '渡辺 健二', kana: 'わたなべ けんじ', dob: '1982年8月30日', gender: '男性', zip: '260-0013', phone: '070-2222-3333', address: '千葉県千葉市中央区3-6-9', notes: '' },
    { card_id: '41207', name: '加藤 直樹', kana: 'かとう なおき', dob: '1988年4月7日', gender: '男性', zip: '155-0031', phone: '090-4444-5555', address: '東京都世田谷区下北沢5-8-2', notes: '五十肩' },
    { card_id: '55023', name: '松本 浩二', kana: 'まつもと こうじ', dob: '1975年12月25日', gender: '男性', zip: '166-0002', phone: '080-6666-7777', address: '東京都杉並区高円寺6-3-4', notes: '' },
    { card_id: '62891', name: '井上 大輔', kana: 'いのうえ だいすけ', dob: '1991年6月18日', gender: '男性', zip: '153-0061', phone: '070-8888-9999', address: '東京都目黒区中目黒7-1-5', notes: '腰椎椎間板ヘルニア' },
    { card_id: '71344', name: '清水 哲也', kana: 'しみず てつや', dob: '1980年10月11日', gender: '男性', zip: '141-0032', phone: '090-0000-1111', address: '東京都品川区大崎8-2-7', notes: '' },
    { card_id: '83006', name: '山口 洋子', kana: 'やまぐち ようこ', dob: '1968年3月28日', gender: '女性', zip: '212-0014', phone: '080-1111-2222', address: '神奈川県川崎市幸区山王1-1-1', notes: '坐骨神経痛' },
    { card_id: '94512', name: '藤田 義雄', kana: 'ふじた よしお', dob: '1958年7月4日', gender: '男性', zip: '175-0094', phone: '090-3456-7890', address: '東京都板橋区成増9-3-6', notes: '変形性膝関節症' },
    { card_id: '99999', name: '高橋 美咲', kana: 'たかはし みさき', dob: '1993年1月31日', gender: '女性', zip: '177-0045', phone: '070-9876-5432', address: '東京都練馬区石神井公園2-5-8', notes: '産後の骨盤矯正' },
    { card_id: '10567', name: '小林 恵子', kana: 'こばやし けいこ', dob: '1987年6月22日', gender: '女性', zip: '164-0011', phone: '090-2345-6789', address: '東京都中野区中央3-4-5', notes: '肩関節周囲炎' },
    { card_id: '20345', name: '中村さやか', kana: 'なかむら さやか', dob: '1994年10月8日', gender: '女性', zip: '113-0033', phone: '080-3456-7890', address: '東京都文京区本郷1-7-3', notes: 'ランニング後の膝痛' },
    { card_id: '30789', name: '木村 優子', kana: 'きむら ゆうこ', dob: '1989年4月15日', gender: '女性', zip: '110-0005', phone: '070-4567-8901', address: '東京都台東区上野5-2-1', notes: '慢性腰痛・デスクワーク' },
  ]);
  if (patientsError) console.error('patients error:', patientsError);
  else console.log('patients挿入完了');
}

seed();
