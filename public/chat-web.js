/* Chat de la web de la inmobiliaria. Se pega en su sitio con:
 *   <script src="https://DOMINIO-DEL-CRM/chat-web.js" data-empresa="IDENTIFICADOR" defer></script>
 * Dibuja un botón flotante; al tocarlo abre el chat (/chat/IDENTIFICADOR) en un recuadro. No usa cookies del sitio. */
(function () {
  var s = document.currentScript;
  if (!s || window.__chatWebCargado) return;
  window.__chatWebCargado = true;
  var empresa = s.getAttribute("data-empresa");
  if (!empresa || !/^[a-z0-9-]+$/.test(empresa)) return;
  var origen = new URL(s.src).origin;
  var color = /^#[0-9A-Fa-f]{6}$/.test(s.getAttribute("data-color") || "") ? s.getAttribute("data-color") : "#B4532A";

  var boton = document.createElement("button");
  boton.type = "button";
  boton.setAttribute("aria-label", "Abrir chat");
  boton.style.cssText = "position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;z-index:2147483646;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;background:" + color;
  boton.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  var caja = null;
  function abrir() {
    if (!caja) {
      caja = document.createElement("iframe");
      caja.src = origen + "/chat/" + empresa;
      caja.title = "Chat";
      caja.setAttribute("allow", "clipboard-write");
      document.body.appendChild(caja);
    }
    var celular = window.innerWidth < 640;
    caja.style.cssText = "position:fixed;z-index:2147483647;border:0;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.25);" +
      (celular ? "inset:0;width:100%;height:100%;" : "right:20px;bottom:20px;width:380px;height:580px;max-height:calc(100vh - 40px);border-radius:20px;");
    boton.style.display = "none";
  }
  function cerrar() {
    if (caja) caja.style.display = "none";
    boton.style.display = "flex";
  }
  boton.addEventListener("click", abrir);
  window.addEventListener("message", function (e) {
    if (e.origin === origen && e.data && e.data.tipo === "chat-web:cerrar") cerrar();
  });
  function montar() { document.body.appendChild(boton); }
  if (document.body) montar(); else document.addEventListener("DOMContentLoaded", montar);
})();
