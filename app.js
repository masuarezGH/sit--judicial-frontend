const API_BASE_URL = "http://localhost:8080";

const state = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null")
};

let currentTicketId = null;
let currentTicketData = null;
let activosCache = [];
let contratosCache = [];

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });
}

function showApp() {
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  document.getElementById("user-name").textContent = state.user?.email || "Usuario";
  document.getElementById("user-role").textContent = state.user?.rol || "-";

  applyRoleVisibility();
  loadDashboard();
  loadActivos();
  loadTickets();
  loadContratos();

  if (state.user?.rol === "ADMIN") {
    loadUsuarios();
  }
}

function showLogin() {
  loginScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

function saveSession(token) {
  const payload = JSON.parse(atob(token.split(".")[1]));
  state.token = token;
  state.user = payload;
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(payload));
}

function logout() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  showLogin();
}

function applyRoleVisibility() {
  const rol = state.user?.rol;
  const isAdmin = rol === "ADMIN";
  const isOperador = rol === "OPERADOR";
  const isTecnico = rol === "TECNICO";

  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = isAdmin ? "" : "none";
  });

  document.querySelectorAll(".op-admin-only").forEach(el => {
    el.style.display = (isAdmin || isOperador) ? "" : "none";
  });

  const navDashboard = document.querySelector('[data-view="dashboard"]');
  const navInventario = document.querySelector('[data-view="inventario"]');
  const navContratos = document.querySelector('[data-view="contratos"]');
  const navUsuarios = document.querySelector('[data-view="usuarios"]');

  if (navDashboard) navDashboard.style.display = isTecnico ? "none" : "";
  if (navInventario) navInventario.style.display = isTecnico ? "none" : "";
  if (navContratos) navContratos.style.display = isTecnico ? "none" : "";
  if (navUsuarios) navUsuarios.style.display = isAdmin ? "" : "none";

  if (isTecnico) {
    showView("tickets");
  }
}

function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(v => v.classList.remove("active"));

  document.getElementById(viewId)?.classList.add("active");
  document.querySelector(`[data-view="${viewId}"]`)?.classList.add("active");
  document.getElementById("view-title").textContent =
    viewId.charAt(0).toUpperCase() + viewId.slice(1);
}

function badgeClass(value) {
  if (value === "Cerrado" || value === "Vigente" || value === "Operativo" || value === true) {
    return "badge-success";
  }
  if (value === "Alta" || value === "Dado de Baja") {
    return "badge-danger";
  }
  if (value === "Abierto" || value === "En Proceso" || value === "Media" || value === "Vencido" || value === "Falla") {
    return "badge-warning";
  }
  return "badge-info";
}

function extraerNumeroDesdeId(id, prefijo) {
  if (!id || !id.startsWith(prefijo)) return 0;
  const numero = parseInt(id.replace(prefijo, ""), 10);
  return isNaN(numero) ? 0 : numero;
}

function formatearId(prefijo, numero, longitud = 5) {
  return `${prefijo}${String(numero).padStart(longitud, "0")}`;
}

function limpiarFormularioActivo() {
  document.getElementById("activo-form")?.reset();
  const categoria = document.getElementById("activo-categoria");
  if (categoria) categoria.value = "HARDWARE";
  actualizarModalActivoPorCategoria();
}

function actualizarModalActivoPorCategoria() {
  const categoria = document.getElementById("activo-categoria")?.value;

  const title = document.getElementById("activo-modal-title");
  const tipoInput = document.getElementById("activo-tipo");
  const marcaInput = document.getElementById("activo-marca");
  const modeloLabel = document.getElementById("activo-modelo-label");
  const modeloInput = document.getElementById("activo-modelo");
  const serieLabel = document.getElementById("activo-serie-label");
  const serieInput = document.getElementById("activo-serie");
  const juzgadoContainer = document.getElementById("activo-juzgado-container");
  const puestoContainer = document.getElementById("activo-puesto-container");

  if (!categoria) return;

  if (categoria === "SOFTWARE") {
    if (title) title.textContent = "Nuevo software";
    if (tipoInput) tipoInput.placeholder = "Ej: Sistema Operativo / Antivirus / Licencia";
    if (marcaInput) marcaInput.placeholder = "Ej: Microsoft / Adobe / ESET";
    if (modeloLabel) modeloLabel.textContent = "Versión / Producto";
    if (modeloInput) modeloInput.placeholder = "Ej: Office 365 / Windows 11 Pro";
    if (serieLabel) serieLabel.textContent = "Licencia / Clave";
    if (serieInput) serieInput.placeholder = "Ej: XXXXX-XXXXX-XXXXX";
    if (juzgadoContainer) juzgadoContainer.style.display = "none";
    if (puestoContainer) puestoContainer.style.display = "none";
  } else {
    if (title) title.textContent = "Nuevo hardware";
    if (tipoInput) tipoInput.placeholder = "Ej: PC Escritorio / Monitor / Impresora";
    if (marcaInput) marcaInput.placeholder = "Ej: Dell / HP / Lenovo";
    if (modeloLabel) modeloLabel.textContent = "Modelo";
    if (modeloInput) modeloInput.placeholder = "Ej: Optiplex 3080";
    if (serieLabel) serieLabel.textContent = "Número de serie";
    if (serieInput) serieInput.placeholder = "Ej: SN123456";
    if (juzgadoContainer) juzgadoContainer.style.display = "";
    if (puestoContainer) puestoContainer.style.display = "";
  }
}

function getEstadoVencimientoContrato(fechaFin) {
  if (!fechaFin) return { texto: "SIN ALERTA", clase: "badge-info" };

  const hoy = new Date();
  const fin = new Date(fechaFin);

  hoy.setHours(0, 0, 0, 0);
  fin.setHours(0, 0, 0, 0);

  const diffMs = fin - hoy;
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (dias <= 7 && dias >= 0) return { texto: "URGENTE", clase: "badge-danger" };
  if (dias <= 30 && dias > 7) return { texto: "POR VENCER", clase: "badge-warning" };
  return { texto: "SIN ALERTA", clase: "badge-success" };
}

async function generarSiguienteIdActivo() {
  const res = await api("/api/activos");
  if (!res.ok) return "INV-00001";

  const activos = await res.json();
  const max = activos.reduce((acc, a) => Math.max(acc, extraerNumeroDesdeId(a.id, "INV-")), 0);
  return formatearId("INV-", max + 1);
}

async function generarSiguienteIdTicket() {
  const res = await api("/api/tickets");
  if (!res.ok) return "TK-00001";

  const tickets = await res.json();
  const max = tickets.reduce((acc, t) => Math.max(acc, extraerNumeroDesdeId(t.id, "TK-")), 0);
  return formatearId("TK-", max + 1);
}

async function generarSiguienteIdContrato() {
  const res = await api("/api/contratos");
  if (!res.ok) return "CT-00001";

  const contratos = await res.json();
  const max = contratos.reduce((acc, c) => Math.max(acc, extraerNumeroDesdeId(c.id, "CT-")), 0);
  return formatearId("CT-", max + 1);
}

async function abrirModalActivo(categoria = "HARDWARE") {
  limpiarFormularioActivo();
  document.getElementById("activo-categoria").value = categoria;
  actualizarModalActivoPorCategoria();
  await cargarContratosEnSelect();
  document.getElementById("activo-id").value = await generarSiguienteIdActivo();
  document.getElementById("activo-modal").classList.remove("hidden");
}

async function loadDashboard() {
  try {
    const [resResumen, resRecientes] = await Promise.all([
      api("/api/dashboard/resumen"),
      api("/api/dashboard/tickets-recientes")
    ]);

    if (!resResumen.ok || !resRecientes.ok) return;

    const resumen = await resResumen.json();
    const recientes = await resRecientes.json();

    document.getElementById("dash-open").textContent = resumen.ticketsAbiertos ?? 0;
    document.getElementById("dash-closed").textContent = resumen.ticketsCerrados ?? 0;
    document.getElementById("dash-high").textContent = resumen.ticketsAltaPrioridad ?? 0;
    document.getElementById("dash-contracts").textContent = resumen.contratosUrgentes ?? 0;

    const tbody = document.getElementById("recent-tickets-body");
    tbody.innerHTML = "";

    recientes.forEach(t => {
      tbody.innerHTML += `
        <tr>
          <td>${t.id}</td>
          <td>${t.asunto}</td>
          <td><span class="badge ${badgeClass(t.prioridad)}">${t.prioridad}</span></td>
          <td><span class="badge ${badgeClass(t.estado)}">${t.estado}</span></td>
          <td>${t.tecnico_nombre || "-"}</td>
        </tr>
      `;
    });
  } catch (e) {
    console.error("Dashboard error", e);
  }
}

async function loadActivos() {
  try {
    const res = await api("/api/activos");
    if (!res.ok) return;

    activosCache = await res.json();
    renderActivosInventario();
  } catch (e) {
    console.error("Activos error", e);
  }
}

async function reactivarActivo(id) {
  if (!confirm(`¿Reactivar el activo ${id}?`)) return;

  const res = await api(`/api/activos/${id}/reactivar`, { method: "PUT" });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "No se pudo reactivar el activo");
    return;
  }

  alert(data.mensaje);
  loadActivos();
  loadDashboard();
}

function renderActivosInventario() {
  const hardwareBody = document.getElementById("hardware-body");
  const softwareBody = document.getElementById("software-body");
  if (!hardwareBody || !softwareBody) return;

  const hardwareSearch = document.getElementById("hardware-search")?.value?.toLowerCase() || "";
  const softwareSearch = document.getElementById("software-search")?.value?.toLowerCase() || "";
  const hardwareEstado = document.getElementById("hardware-estado-filter")?.value || "";
  const softwareEstado = document.getElementById("software-estado-filter")?.value || "";

  hardwareBody.innerHTML = "";
  softwareBody.innerHTML = "";

  const hardware = activosCache.filter(a => (a.categoria || "HARDWARE").toUpperCase() === "HARDWARE");
  const software = activosCache.filter(a => (a.categoria || "HARDWARE").toUpperCase() === "SOFTWARE");

  const hardwareFiltrado = hardware.filter(a => {
    const texto = `${a.id || ""} ${a.tipo || ""} ${a.marca || ""} ${a.modelo || ""}`.toLowerCase();
    return (!hardwareSearch || texto.includes(hardwareSearch)) && (!hardwareEstado || a.estado === hardwareEstado);
  });

  const softwareFiltrado = software.filter(a => {
    const texto = `${a.id || ""} ${a.tipo || ""} ${a.marca || ""} ${a.modelo || ""}`.toLowerCase();
    return (!softwareSearch || texto.includes(softwareSearch)) && (!softwareEstado || a.estado === softwareEstado);
  });

  hardwareFiltrado.forEach(a => {
    const accionActivo =
      a.estado === "Dado de Baja"
        ? `<button class="btn btn-success" onclick="reactivarActivo('${a.id}')">Reactivar</button>`
        : (
            (state.user?.rol === "ADMIN" || state.user?.rol === "OPERADOR")
              ? `<button class="btn btn-danger" onclick="darBajaActivo('${a.id}')">Baja</button>`
              : ""
          );

    hardwareBody.innerHTML += `
      <tr>
        <td>${a.id}</td>
        <td>${a.tipo}</td>
        <td>${a.marca}</td>
        <td>${a.modelo}</td>
        <td><span class="badge ${badgeClass(a.estado)}">${a.estado}</span></td>
        <td class="action-buttons">
          <button class="btn btn-outline" onclick="verHistorial('${a.id}')">Historial</button>
          ${accionActivo}
        </td>
      </tr>
    `;
  });

  softwareFiltrado.forEach(a => {
    const accionActivo =
  a.estado === "Dado de Baja"
    ? `<button class="btn btn-success" onclick="reactivarActivo('${a.id}')">Reactivar</button>`
    : (
        (state.user?.rol === "ADMIN" || state.user?.rol === "OPERADOR")
          ? `<button class="btn btn-danger" onclick="darBajaActivo('${a.id}')">Baja</button>`
          : ""
      );

    softwareBody.innerHTML += `
      <tr>
        <td>${a.id}</td>
        <td>${a.tipo}</td>
        <td>${a.marca}</td>
        <td>${a.modelo}</td>
        <td><span class="badge ${badgeClass(a.estado)}">${a.estado}</span></td>
        <td class="action-buttons">
          <button class="btn btn-outline" onclick="verHistorial('${a.id}')">Historial</button>
          ${accionActivo}
        </td>

      </tr>
    `;
  });

  if (!hardwareBody.innerHTML) {
    hardwareBody.innerHTML = `<tr><td colspan="6">No hay hardware registrado.</td></tr>`;
  }

  if (!softwareBody.innerHTML) {
    softwareBody.innerHTML = `<tr><td colspan="6">No hay software registrado.</td></tr>`;
  }

  document.getElementById("hardware-count").textContent =
    activosCache.filter(a => (a.categoria || "HARDWARE").toUpperCase() === "HARDWARE").length;

  document.getElementById("software-count").textContent =
    activosCache.filter(a => (a.categoria || "HARDWARE").toUpperCase() === "SOFTWARE").length;

  document.getElementById("activos-operativos-count").textContent =
    activosCache.filter(a => a.estado === "Operativo").length;

  document.getElementById("activos-baja-count").textContent =
    activosCache.filter(a => a.estado === "Dado de Baja").length;
}

async function loadTickets() {
  try {
    const res = await api("/api/tickets");
    if (!res.ok) return;

    const tickets = await res.json();
    const tbody = document.getElementById("tickets-body");
    tbody.innerHTML = "";

    tickets.forEach(t => {
      const canClose = state.user?.rol === "ADMIN" || state.user?.rol === "OPERADOR" || state.user?.rol === "TECNICO";

      tbody.innerHTML += `
        <tr>
          <td>${t.id}</td>
          <td>${t.activo_id}</td>
          <td>${t.asunto}</td>
          <td><span class="badge ${badgeClass(t.prioridad)}">${t.prioridad}</span></td>
          <td><span class="badge ${badgeClass(t.estado)}">${t.estado}</span></td>
          <td>${t.tecnico_nombre || "-"}</td>
          <td class="action-buttons">
            <button class="btn btn-outline" onclick="verDetalleTicket('${t.id}')">Ver detalle</button>
            ${canClose && t.estado !== "Cerrado" ? `<button class="btn btn-danger" onclick="cerrarTicket('${t.id}')">Cerrar</button>` : ""}
          </td>
        </tr>
      `;
    });
  } catch (e) {
    console.error("Tickets error", e);
  }
}

async function loadContratos() {
  try {
    const res = await api("/api/contratos");
    if (!res.ok) return;

    contratosCache = await res.json();
    renderContratos();
  } catch (e) {
    console.error("Contratos error", e);
  }
}

function renderContratos() {
  const tbody = document.getElementById("contratos-body");
  if (!tbody) return;

  const filtroEstado = document.getElementById("contratos-estado-filter")?.value || "";
  const filtroAlerta = document.getElementById("contratos-alerta-filter")?.value || "";

  tbody.innerHTML = "";

  const filtrados = contratosCache.filter(c => {
    const alerta = getEstadoVencimientoContrato(c.fecha_fin).texto;
    const coincideEstado = !filtroEstado || c.estado === filtroEstado;
    const coincideAlerta = !filtroAlerta || alerta === filtroAlerta;
    return coincideEstado && coincideAlerta;
  });

  filtrados.forEach(c => {
    const alerta = getEstadoVencimientoContrato(c.fecha_fin);

    tbody.innerHTML += `
      <tr>
        <td>${c.id}</td>
        <td>${c.proveedor}</td>
        <td>${c.tipo}</td>
        <td>${c.fecha_inicio?.split("T")[0] || c.fecha_inicio}</td>
        <td>${c.fecha_fin?.split("T")[0] || c.fecha_fin}</td>
        <td><span class="badge ${badgeClass(c.estado)}">${c.estado}</span></td>
        <td><span class="badge ${alerta.clase}">${alerta.texto}</span></td>
      </tr>
    `;
  });

  if (!tbody.innerHTML) {
    tbody.innerHTML = `<tr><td colspan="7">No hay contratos para ese filtro.</td></tr>`;
  }
}

async function loadUsuarios() {
  try {
    const res = await api("/api/usuarios");
    if (!res.ok) return;

    const usuarios = await res.json();
    const tbody = document.getElementById("usuarios-body");
    tbody.innerHTML = "";

    usuarios.forEach(u => {
  const accionBoton = u.activo
    ? `<button class="btn btn-danger" onclick="desactivarUsuario('${u.id}')">Desactivar</button>`
    : `<button class="btn btn-success" onclick="reactivarUsuario('${u.id}')">Reactivar</button>`;

  tbody.innerHTML += `
    <tr>
      <td>${u.id}</td>
      <td>${u.nombre}</td>
      <td>${u.email}</td>
      <td>${u.rol}</td>
      <td><span class="badge ${badgeClass(u.activo)}">${u.activo ? "Activo" : "Inactivo"}</span></td>
      <td>${accionBoton}</td>
    </tr>
  `;
});
  } catch (e) {
    console.error("Usuarios error", e);
  }
}

async function desactivarUsuario(id) {
  if (!confirm(`¿Desactivar el usuario ${id}?`)) return;

  const res = await api(`/api/usuarios/${id}/desactivar`, { method: "PUT" });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "No se pudo desactivar el usuario");
    return;
  }

  alert(data.mensaje);
  loadUsuarios();
}

async function reactivarUsuario(id) {
  if (!confirm(`¿Reactivar el usuario ${id}?`)) return;

  const res = await api(`/api/usuarios/${id}/reactivar`, { method: "PUT" });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "No se pudo reactivar el usuario");
    return;
  }

  alert(data.mensaje);
  loadUsuarios();
}

async function cargarTecnicosEnSelectDetalle(selectedId = "") {
  try {
    const res = await api("/api/usuarios");
    if (!res.ok) return;

    const usuarios = await res.json();
    const select = document.getElementById("ticket-detail-tecnico");
    if (!select) return;

    select.innerHTML = `<option value="">Sin asignar</option>`;

    usuarios
      .filter(u => u.rol === "TECNICO" && u.activo)
      .forEach(u => {
        select.innerHTML += `
          <option value="${u.id}" ${String(u.id) === String(selectedId) ? "selected" : ""}>
            ${u.id} - ${u.nombre}
          </option>
        `;
      });

    actualizarNombreTecnicoDetalle();
  } catch (error) {
    console.error("Error cargando técnicos en detalle:", error);
  }
}

function actualizarNombreTecnicoDetalle() {
  const select = document.getElementById("ticket-detail-tecnico");
  const nombreInput = document.getElementById("ticket-detail-tecnico-nombre");
  if (!select || !nombreInput) return;

  const selectedOption = select.options[select.selectedIndex];

  if (!selectedOption || !select.value) {
    nombreInput.value = "Sin asignar";
    return;
  }

  const texto = selectedOption.textContent || "";
  const partes = texto.split(" - ");
  nombreInput.value = partes.length > 1 ? partes.slice(1).join(" - ") : texto;
}

async function cargarContratosEnSelect() {
  try {
    const res = await api("/api/contratos");
    if (!res.ok) return;

    const contratos = await res.json();
    const select = document.getElementById("activo-contrato");
    if (!select) return;

    select.innerHTML = `<option value="">Sin contrato</option>`;

    contratos
      .filter(c => c.estado === "Vigente")
      .forEach(c => {
        select.innerHTML += `
          <option value="${c.id}">
            ${c.id} - ${c.proveedor} - ${c.tipo}
          </option>
        `;
      });
  } catch (error) {
    console.error("Error cargando contratos:", error);
  }
}

async function cargarActivosDisponiblesEnSelect() {
  try {
    const res = await api("/api/activos");
    if (!res.ok) return;

    const activos = await res.json();
    const select = document.getElementById("ticket-activo-id");
    if (!select) return;

    select.innerHTML = `<option value="">Seleccionar activo</option>`;

    activos
      .filter(a => a.estado !== "Dado de Baja")
      .forEach(a => {
        select.innerHTML += `
          <option value="${a.id}">
            ${a.id} - ${a.tipo} - ${a.marca} ${a.modelo}
          </option>
        `;
      });
  } catch (error) {
    console.error("Error cargando activos para ticket:", error);
  }
}

async function cargarTecnicosEnSelect() {
  try {
    const res = await api("/api/usuarios");
    if (!res.ok) return;

    const usuarios = await res.json();
    const select = document.getElementById("ticket-tecnico");
    if (!select) return;

    select.innerHTML = `<option value="">Sin asignar</option>`;

    usuarios
      .filter(u => u.rol === "TECNICO" && u.activo)
      .forEach(u => {
        select.innerHTML += `
          <option value="${u.id}">
            ${u.id} - ${u.nombre}
          </option>
        `;
      });
  } catch (error) {
    console.error("Error cargando técnicos:", error);
  }
}

async function verDetalleTicket(id) {
  try {
    const res = await api(`/api/tickets/${id}`);
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "No se pudo cargar el ticket");
      return;
    }

    currentTicketId = data.id;
    currentTicketData = data;

    document.getElementById("ticket-detail-title").textContent = `Detalle de ticket: ${data.id}`;
    document.getElementById("ticket-detail-id").value = data.id;
    document.getElementById("ticket-detail-activo").value = data.activo_id;
    document.getElementById("ticket-detail-asunto").value = data.asunto || "";
    document.getElementById("ticket-detail-descripcion").value = data.descripcion || "";
    document.getElementById("ticket-detail-bitacora").value = data.bitacora || "";
    document.getElementById("ticket-detail-prioridad").value = data.prioridad || "Media";
    document.getElementById("ticket-detail-estado").value = data.estado || "Abierto";
    await cargarTecnicosEnSelectDetalle(data.tecnico_asignado || "");
    document.getElementById("ticket-detail-tecnico-nombre").value = data.tecnico_nombre || "Sin asignar";
    document.getElementById("ticket-detail-fecha-creacion").value =
      data.fecha_creacion ? new Date(data.fecha_creacion).toLocaleString() : "-";
    document.getElementById("ticket-detail-fecha-cierre").value =
      data.fecha_cierre ? new Date(data.fecha_cierre).toLocaleString() : "-";

    const isAdmin = state.user?.rol === "ADMIN";
    const isOperador = state.user?.rol === "OPERADOR";
    const isTecnico = state.user?.rol === "TECNICO";
    const canEdit = (isAdmin || isOperador || isTecnico) && data.estado !== "Cerrado";
    const canClose = (isAdmin || isOperador || isTecnico) && data.estado !== "Cerrado";

    document.getElementById("ticket-detail-asunto").disabled = !(isAdmin || isOperador);
    document.getElementById("ticket-detail-prioridad").disabled = !(isAdmin || isOperador);
    document.getElementById("ticket-detail-estado").disabled = !canEdit;
    document.getElementById("ticket-detail-tecnico").disabled = !(isAdmin || isOperador);
    document.getElementById("ticket-detail-descripcion").disabled = !(isAdmin || isOperador);
    document.getElementById("ticket-detail-bitacora").disabled = !(isAdmin || isTecnico);

    document.getElementById("ticket-detail-save-btn").style.display = canEdit ? "" : "none";
    document.getElementById("ticket-detail-close-btn").style.display = canClose ? "" : "none";

    document.getElementById("ticket-detail-modal").classList.remove("hidden");
  } catch (error) {
    console.error("Detalle ticket error", error);
    alert("No se pudo cargar el ticket");
  }
}

async function cerrarTicketDesdeModal(id) {
  if (!confirm(`¿Deseás cerrar el ticket ${id}?`)) return;

  const res = await api(`/api/tickets/${id}/cerrar`, { method: "PUT" });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "No se pudo cerrar el ticket");
    return;
  }

  alert(data.mensaje);
  document.getElementById("ticket-detail-modal").classList.add("hidden");
  loadTickets();
  loadDashboard();
}

async function verHistorial(id) {
  const res = await api(`/api/activos/${id}/historial`);

  if (!res.ok) {
    alert("No se pudo cargar el historial");
    return;
  }

  const data = await res.json();

  const info = document.getElementById("historial-info");
  const historialBody = document.getElementById("historial-body");
  const ticketsBody = document.getElementById("historial-tickets-body");

  info.innerHTML = `
    <h4 style="margin-bottom:10px; color: var(--primary);">Datos generales</h4>
    <div class="historial-grid" style="margin-bottom:16px;">
      <div><strong>ID:</strong> ${data.activo.id || "-"}</div>
      <div><strong>Categoría:</strong> ${data.activo.categoria || "-"}</div>
      <div><strong>Tipo:</strong> ${data.activo.tipo || "-"}</div>
      <div><strong>Marca:</strong> ${data.activo.marca || "-"}</div>
      <div><strong>Modelo:</strong> ${data.activo.modelo || "-"}</div>
      <div><strong>N° Serie / Licencia:</strong> ${data.activo.numero_serie || "-"}</div>
      <div>
        <strong>Estado:</strong>
        <span class="badge ${badgeClass(data.activo.estado)}">${data.activo.estado || "-"}</span>
      </div>
    </div>

    <h4 style="margin-bottom:10px; color: var(--primary);">Ubicación</h4>
    <div class="historial-grid" style="margin-bottom:16px;">
      <div><strong>Juzgado:</strong> ${data.activo.juzgado || "-"}</div>
      <div><strong>Puesto de trabajo:</strong> ${data.activo.puesto_trabajo || "-"}</div>
    </div>

    <h4 style="margin-bottom:10px; color: var(--primary);">Contrato asignado</h4>
    <div class="historial-grid">
      <div><strong>ID contrato:</strong> ${data.activo.contrato_codigo || "-"}</div>
      <div><strong>Proveedor:</strong> ${data.activo.contrato_proveedor || "-"}</div>
      <div><strong>Tipo:</strong> ${data.activo.contrato_tipo || "-"}</div>
      <div><strong>Inicio:</strong> ${
        data.activo.contrato_fecha_inicio
          ? new Date(data.activo.contrato_fecha_inicio).toLocaleDateString()
          : "-"
      }</div>
      <div><strong>Fin:</strong> ${
        data.activo.contrato_fecha_fin
          ? new Date(data.activo.contrato_fecha_fin).toLocaleDateString()
          : "-"
      }</div>
      <div><strong>Estado:</strong> ${data.activo.contrato_estado || "-"}</div>
    </div>
  `;

  historialBody.innerHTML = "";
  ticketsBody.innerHTML = "";

  if (!data.historial || data.historial.length === 0) {
    historialBody.innerHTML = `<tr><td colspan="2">Sin eventos registrados</td></tr>`;
  } else {
    data.historial.forEach(h => {
      historialBody.innerHTML += `
        <tr>
          <td>${h.fecha_evento ? new Date(h.fecha_evento).toLocaleString() : "-"}</td>
          <td>${h.evento}</td>
        </tr>
      `;
    });
  }

  if (!data.tickets || data.tickets.length === 0) {
    ticketsBody.innerHTML = `<tr><td colspan="5">Sin tickets asociados</td></tr>`;
  } else {
    data.tickets.forEach(t => {
      ticketsBody.innerHTML += `
        <tr>
          <td>${t.id}</td>
          <td>${t.asunto}</td>
          <td><span class="badge ${badgeClass(t.prioridad)}">${t.prioridad}</span></td>
          <td><span class="badge ${badgeClass(t.estado)}">${t.estado}</span></td>
          <td>${t.tecnico_nombre || "-"}</td>
        </tr>
      `;
    });
  }

  document.getElementById("historial-modal").classList.remove("hidden");
}

async function darBajaActivo(id) {
  if (!confirm(`¿Dar de baja el activo ${id}?`)) return;

  const res = await api(`/api/activos/${id}/baja`, { method: "PUT" });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "No se pudo dar de baja");
    return;
  }

  alert(data.mensaje);
  loadActivos();
  loadDashboard();
}

async function cerrarTicket(id) {
  if (!confirm(`¿Deseás cerrar el ticket ${id}?`)) return;

  const res = await api(`/api/tickets/${id}/cerrar`, { method: "PUT" });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "No se pudo cerrar el ticket");
    return;
  }

  alert(data.mensaje);
  loadTickets();
  loadDashboard();
}

/* =========================
   EVENT LISTENERS
========================= */

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  try {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      loginError.textContent = data.error || "Error al iniciar sesión";
      return;
    }

    saveSession(data.token);
    showApp();
  } catch {
    loginError.textContent = "No se pudo conectar con el backend";
  }
});

document.getElementById("ticket-detail-tecnico")?.addEventListener("change", actualizarNombreTecnicoDetalle);

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

document.getElementById("logout-btn")?.addEventListener("click", logout);

document.getElementById("btn-open-hardware-modal")?.addEventListener("click", async () => {
  await abrirModalActivo("HARDWARE");
});

document.getElementById("btn-open-software-modal")?.addEventListener("click", async () => {
  await abrirModalActivo("SOFTWARE");
});

document.getElementById("btn-open-ticket-modal")?.addEventListener("click", async () => {
  await cargarActivosDisponiblesEnSelect();

  if (state.user?.rol === "ADMIN") {
    await cargarTecnicosEnSelect();
  } else {
    const tecnicoSelect = document.getElementById("ticket-tecnico");
    if (tecnicoSelect) tecnicoSelect.innerHTML = `<option value="">Sin asignar</option>`;
  }

  document.getElementById("ticket-id").value = await generarSiguienteIdTicket();
  document.getElementById("ticket-modal").classList.remove("hidden");
});

document.getElementById("btn-open-contrato-modal")?.addEventListener("click", async () => {
  document.getElementById("contrato-form").reset();
  document.getElementById("contrato-id").value = await generarSiguienteIdContrato();
  document.getElementById("contrato-modal").classList.remove("hidden");
});

document.getElementById("btn-open-usuario-modal")?.addEventListener("click", () => {
  document.getElementById("usuario-modal").classList.remove("hidden");
});

document.getElementById("btn-crear-contrato-desde-activo")?.addEventListener("click", async () => {
  document.getElementById("contrato-form").reset();
  document.getElementById("contrato-id").value = await generarSiguienteIdContrato();
  document.getElementById("contrato-modal").classList.remove("hidden");
});

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById(btn.dataset.close).classList.add("hidden");
  });
});

document.getElementById("ticket-detail-close-btn")?.addEventListener("click", async () => {
  if (!currentTicketId) return;
  await cerrarTicketDesdeModal(currentTicketId);
});

document.getElementById("hardware-search")?.addEventListener("input", renderActivosInventario);
document.getElementById("hardware-estado-filter")?.addEventListener("change", renderActivosInventario);
document.getElementById("software-search")?.addEventListener("input", renderActivosInventario);
document.getElementById("software-estado-filter")?.addEventListener("change", renderActivosInventario);
document.getElementById("contratos-alerta-filter")?.addEventListener("change", renderContratos);
document.getElementById("activo-categoria")?.addEventListener("change", actualizarModalActivoPorCategoria);

document.getElementById("activo-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    id: document.getElementById("activo-id").value,
    categoria: document.getElementById("activo-categoria").value,
    tipo: document.getElementById("activo-tipo").value,
    marca: document.getElementById("activo-marca").value,
    modelo: document.getElementById("activo-modelo").value,
    numero_serie: document.getElementById("activo-serie").value || null,
    juzgado: document.getElementById("activo-categoria").value === "SOFTWARE"
      ? null
      : (document.getElementById("activo-juzgado").value || null),
    puesto_trabajo: document.getElementById("activo-categoria").value === "SOFTWARE"
      ? null
      : (document.getElementById("activo-puesto").value || null),
    contrato_id: document.getElementById("activo-contrato").value || !null
  };

  try {
    const res = await api("/api/activos", {
      method: "POST",
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok) {
      return alert(data.error || "Error al crear activo");
    }

    alert(data.mensaje);
    document.getElementById("activo-modal").classList.add("hidden");
    e.target.reset();
    loadActivos();
  } catch (error) {
    console.error("Error frontend activo:", error);
    alert("No se pudo conectar con el backend al crear el activo");
  }
});

document.getElementById("ticket-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const activoId = document.getElementById("ticket-activo-id").value;

  const activoRes = await api(`/api/activos/${activoId}`);
  const activoData = await activoRes.json();

  if (!activoRes.ok) {
    return alert(activoData.error || "Activo no encontrado");
  }

  if (activoData.estado === "Dado de Baja") {
    return alert("No se puede crear un ticket para un activo dado de baja");
  }

  const body = {
    id: document.getElementById("ticket-id").value,
    activo_id: activoId,
    asunto: document.getElementById("ticket-asunto").value,
    descripcion: document.getElementById("ticket-descripcion").value || null,
    prioridad: document.getElementById("ticket-prioridad").value,
    estado: document.getElementById("ticket-estado").value,
    tecnico_asignado: document.getElementById("ticket-tecnico").value || null
  };

  const res = await api("/api/tickets", {
    method: "POST",
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error || "Error al crear ticket");

  alert(data.mensaje);
  document.getElementById("ticket-modal").classList.add("hidden");
  e.target.reset();
  loadTickets();
  loadDashboard();
});

document.getElementById("ticket-detail-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentTicketId || !currentTicketData) return;

  const body = {
    asunto: document.getElementById("ticket-detail-asunto").value,
    descripcion: document.getElementById("ticket-detail-descripcion").value || null,
    bitacora: document.getElementById("ticket-detail-bitacora").value || null,
    prioridad: document.getElementById("ticket-detail-prioridad").value,
    estado: document.getElementById("ticket-detail-estado").value,
    tecnico_asignado: document.getElementById("ticket-detail-tecnico").value || null
  };

  const res = await api(`/api/tickets/${currentTicketId}`, {
    method: "PUT",
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "No se pudo actualizar el ticket");
    return;
  }

  alert(data.mensaje || "Ticket actualizado correctamente");
  document.getElementById("ticket-detail-modal").classList.add("hidden");
  loadTickets();
  loadDashboard();
});

document.getElementById("contrato-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
  id: document.getElementById("contrato-id").value,
  proveedor: document.getElementById("contrato-proveedor").value,
  tipo: document.getElementById("contrato-tipo").value,
  fecha_inicio: document.getElementById("contrato-inicio").value,
  fecha_fin: document.getElementById("contrato-fin").value,
  estado: "Vigente"
};

  const res = await api("/api/contratos", {
    method: "POST",
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error || "Error al crear contrato");

  await cargarContratosEnSelect();
  const activoContrato = document.getElementById("activo-contrato");
  if (activoContrato) activoContrato.value = body.id;

  alert(data.mensaje);
  document.getElementById("contrato-modal").classList.add("hidden");
  e.target.reset();
  loadContratos();
  loadDashboard();
});

document.getElementById("usuario-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    nombre: document.getElementById("usuario-nombre").value,
    email: document.getElementById("usuario-email").value,
    password: document.getElementById("usuario-password").value,
    rol: document.getElementById("usuario-rol").value,
    activo: true
  };

  const res = await api("/api/usuarios", {
    method: "POST",
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error || "Error al crear usuario");

  alert(data.mensaje);
  document.getElementById("usuario-modal").classList.add("hidden");
  e.target.reset();
  loadUsuarios();
});

document.getElementById("btn-open-password-modal")?.addEventListener("click", () => {
  document.getElementById("password-form").reset();
  document.getElementById("password-modal").classList.remove("hidden");
});

document.getElementById("password-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    passwordActual: document.getElementById("password-actual").value,
    passwordNueva: document.getElementById("password-nueva").value,
    confirmarPassword: document.getElementById("password-confirmar").value
  };

  const res = await api("/api/usuarios/cambiar-password", {
    method: "PUT",
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "No se pudo cambiar la contraseña");
    return;
  }

  alert(data.mensaje);
  document.getElementById("password-modal").classList.add("hidden");
});

document.getElementById("contratos-estado-filter")?.addEventListener("change", renderContratos);
document.getElementById("contratos-alerta-filter")?.addEventListener("change", renderContratos);

if (state.token && state.user) {
  showApp();
} else {
  showLogin();
}