/* Calculadora de IMC de la landing (orientativa, para adultos). */
(function () {
  const form = document.getElementById("imc-form");
  if (!form) return;
  const out = document.getElementById("imc-out");

  function categoria(imc) {
    if (imc < 18.5) return "Por debajo del rango de referencia";
    if (imc < 25) return "Dentro del rango de referencia";
    if (imc < 30) return "Sobrepeso";
    return "Obesidad";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const peso = parseFloat(form.peso.value);
    const talla = parseFloat(form.talla.value);
    if (!(peso > 0 && peso < 400) || !(talla >= 100 && talla <= 250)) {
      out.className = "imc-result is-visible";
      out.textContent = "Revisa los datos: peso en kg (por ejemplo 68) y talla en cm (por ejemplo 165).";
      return;
    }
    const m = talla / 100;
    const imc = peso / (m * m);
    out.className = "imc-result is-visible";
    out.innerHTML = "";
    const big = document.createElement("strong");
    big.textContent = imc.toFixed(1);
    const label = document.createElement("div");
    label.textContent = categoria(imc);
    const note = document.createElement("p");
    note.className = "small";
    note.style.margin = ".5rem 0 0";
    note.textContent = "Resultado orientativo según los rangos de la OMS para adultos. No es un diagnóstico: consulta con un profesional de la salud.";
    out.append(big, label, note);
  });
})();
