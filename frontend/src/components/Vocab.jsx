import React from "react";
import { say, buzz } from "../utils/audio";
import { Icon3D } from "./Icon3D";

export function Vocab({ state, setState, onToast }) {
  const vocabList = state.vocab || [];

  const handlePlay = (word) => {
    say(word, false, state.p.lang || "en-US");
  };

  const handleDelete = (index) => {
    buzz(10, state.p.haptic);
    setState((prev) => {
      const updated = [...prev.vocab];
      updated.splice(index, 1);
      return { ...prev, vocab: updated };
    });
    onToast("Lug‘atdan olib tashlandi");
  };

  return (
    <section className="screen on" aria-label="Lug‘at">
      <h2 className="h2 disp" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <Icon3D name="book" size={32} />
        <span>Lug‘atim</span>
      </h2>
      <p className="lead">
        {vocabList.length
          ? `${vocabList.length} ta saqlangan so‘z. AI tahlilida yulduzcha bilan belgilagan iboralaringiz shu yerda to‘planadi.`
          : "AI tahlildan keyin tavsiya etilgan so‘zlarni yulduzcha bilan saqlang. Ular shu yerda to‘planadi."}
      </p>

      {vocabList.length > 0 ? (
        <ul className="vl">
          {vocabList.map((item, index) => (
            <li className="vi" key={index}>
              <div className="vt">
                <b>{item.en}</b>
                <span>{item.uz}</span>
                {item.ex && <q>{item.ex}</q>}
              </div>
              <button
                className="ib"
                onClick={() => handlePlay(item.en)}
                aria-label="Eshitish"
                title="Talaffuzni eshitish"
              >
                <Icon3D name="speaker" size={18} />
              </button>
              <button
                className="ib"
                onClick={() => handleDelete(index)}
                aria-label="O‘chirish"
                title="Lug'atdan o'chirish"
              >
                <Icon3D name="cross" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Hozircha saqlangan yangi so‘zlar yo‘q.</p>
      )}
    </section>
  );
}
