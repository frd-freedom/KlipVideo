import React from 'react';
import { RotateCcw, X } from 'lucide-react';

interface ReferenceVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyReferenceTemplate: () => void;
}

export const ReferenceVideoModal: React.FC<ReferenceVideoModalProps> = ({
  isOpen,
  onClose,
  onApplyReferenceTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#111114] border border-[#27272A] rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#27272A] flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              Video Referensi Gaya Lirik Kode (@codin.dev)
            </h3>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              Referensi visual asli dengan kursor merah, sintaks kode, efek gema komentar, dan cahaya ketukan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal referensi"
            className="p-2 rounded-lg text-[#A1A1AA] hover:text-white hover:bg-[#18181B] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 bg-black flex justify-center">
          <video
            src="/assets/aistudio/b487f8ef00e57b95c01cbc78fcb88dbe_bfa5dc05.mp4"
            controls
            playsInline
            className="max-h-[420px] rounded-lg border border-[#27272A]"
          />
        </div>

        <div className="px-5 py-4 border-t border-[#27272A] flex items-center justify-between gap-4">
          <span className="text-xs text-[#A1A1AA]">
            Gunakan tombol di samping untuk memuat ulang template persis seperti referensi ini.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#D4D4D8] hover:text-white bg-[#18181B] border border-[#27272A] transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => {
                onApplyReferenceTemplate();
                onClose();
              }}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Terapkan Template Referensi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
