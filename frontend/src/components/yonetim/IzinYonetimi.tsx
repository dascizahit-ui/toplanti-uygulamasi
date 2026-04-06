/**
 * İzin Yönetimi Bileşeni
 * ======================
 * Varsayılan toplantı izin ayarlarını gösterir.
 * Sistem geneli izin politikası bilgilendirmesi.
 */

'use client';

import Kart from '@/components/ui/Kart';

export default function IzinYonetimi() {
  const izinPolitikalari = [
    {
      baslik: 'Sahip (Toplantı Oluşturan)',
      aciklama: 'Tüm izinlere sahiptir. Toplantıyı yönetir.',
      izinler: ['Mikrofon', 'Kamera', 'Ekran Paylaşımı', 'Sohbet', 'Katılımcı Atma', 'Rol Değiştirme'],
      renk: 'bg-purple-100 text-purple-800',
    },
    {
      baslik: 'Moderatör',
      aciklama: 'Toplantı içi izinleri yönetebilir.',
      izinler: ['Mikrofon', 'Kamera', 'Ekran Paylaşımı', 'Sohbet', 'Katılımcı Atma'],
      renk: 'bg-blue-100 text-blue-800',
    },
    {
      baslik: 'Katılımcı',
      aciklama: 'Yönetici tarafından verilen izinleri kullanabilir.',
      izinler: ['Mikrofon (izinle)', 'Kamera (izinle)', 'Sohbet (izinle)'],
      renk: 'bg-green-100 text-green-800',
    },
    {
      baslik: 'İzleyici',
      aciklama: 'Sadece izleme yetkisi vardır. Hiçbir medya kullanamaz.',
      izinler: ['Sadece izleme'],
      renk: 'bg-gray-100 text-gray-800',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">İzin Politikaları</h2>
        <p className="text-sm text-slate-500 mt-1">
          Toplantı içi rol ve izin hiyerarşisinin detayları.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {izinPolitikalari.map((politika, i) => (
          <Kart key={i}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${politika.renk}`}>
                {politika.baslik}
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-3">{politika.aciklama}</p>
            <div className="flex flex-wrap gap-1.5">
              {politika.izinler.map((izin, j) => (
                <span key={j} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-md">
                  {izin}
                </span>
              ))}
            </div>
          </Kart>
        ))}
      </div>

      {/* Önemli Kurallar */}
      <Kart className="mt-6">
        <h3 className="font-semibold text-slate-900 mb-3">Önemli Kurallar</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <p>• <strong>Toplantı oluşturma:</strong> Sadece admin ve moderatör yetkisindeki kullanıcılar yapabilir.</p>
          <p>• <strong>Sahip atanamaz:</strong> Sahiplik sadece mevcut sahip tarafından transfer edilebilir.</p>
          <p>• <strong>Sahip atılamaz:</strong> Toplantı sahibi hiçbir koşulda atılamaz.</p>
          <p>• <strong>İzleyiciye düşürme:</strong> İzleyici rolüne düşürülen kullanıcının tüm medya izinleri otomatik kapanır.</p>
          <p>• <strong>Moderatöre yükseltme:</strong> Moderatör yapılan kullanıcının tüm izinleri otomatik açılır.</p>
          <p>• <strong>Toplu işlemler:</strong> "Hepsini Sustur" ve "Kameraları Kapat" sahip ve istek yapanı etkilemez.</p>
        </div>
      </Kart>
    </div>
  );
}
