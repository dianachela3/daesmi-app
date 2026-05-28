// =========================================================================
// DAESMI · Cosmetics & Accessories - Sistema Integral de Ventas y Caja (FIXED)
// =========================================================================

let productos = [];
let combos = [];
let transacciones = [];

// Estado temporal para el armado de combos
let productosEnComboTemporal = [];
let idElementoEdicion = null; 

document.addEventListener("DOMContentLoaded", () => {
    cargarDatosDesdeStorage();
    inicializarNavegacion();
    inicializarModales();
    renderizarInventario();
    renderizarBalance();
});

function cargarDatosDesdeStorage() {
    productos = JSON.parse(localStorage.getItem("daesmi_productos")) || [];
    combos = JSON.parse(localStorage.getItem("daesmi_combos")) || [];
    transacciones = JSON.parse(localStorage.getItem("daesmi_transacciones")) || [];
    
    productos.forEach(p => { if (p.activo === undefined) p.activo = true; });
    combos.forEach(c => { if (c.activo === undefined) c.activo = true; });
}

function guardarProductosEnStorage() { localStorage.setItem("daesmi_productos", JSON.stringify(productos)); }
function guardarCombosEnStorage() { localStorage.setItem("daesmi_combos", JSON.stringify(combos)); }
function guardarTransaccionesEnStorage() { localStorage.setItem("daesmi_transacciones", JSON.stringify(transacciones)); }

function inicializarNavegacion() {
    const btnBalance = document.getElementById("nav-balance");
    const btnInventario = document.getElementById("nav-inventario");
    const btnAjustes = document.getElementById("nav-ajustes");
    const botones = [btnBalance, btnInventario, btnAjustes];

    function cambiarVista(vistaActivaId, botonActivo) {
        const vistas = ["view-balance", "view-inventario", "view-ajustes"];
        vistas.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add("hidden");
        });

        const vistaActiva = document.getElementById(vistaActivaId);
        if (vistaActiva) vistaActiva.classList.remove("hidden");

        botones.forEach(btn => {
            if (btn) {
                btn.classList.remove("text-purple-800");
                btn.classList.add("text-slate-400");
            }
        });

        if (botonActivo) {
            botonActivo.classList.remove("text-slate-400");
            botonActivo.classList.add("text-purple-800");
        }
    }

    if (btnBalance) btnBalance.addEventListener("click", () => { cambiarVista("view-balance", btnBalance); renderizarBalance(); });
    if (btnInventario) btnInventario.addEventListener("click", () => cambiarVista("view-inventario", btnInventario));
    if (btnAjustes) btnAjustes.addEventListener("click", () => cambiarVista("view-ajustes", btnAjustes));
    
    // Accesos rápidos desde el balance protegidos contra nulos
    const dashVenta = document.getElementById("btn-dash-venta");
    const dashCombo = document.getElementById("btn-dash-combo");

    if (dashVenta) dashVenta.addEventListener("click", () => abrirModalVenta());
    if (dashCombo) {
        dashCombo.addEventListener("click", () => {
            cambiarVista("view-inventario", btnInventario);
            abrirModalCombo();
        });
    }
}

function inicializarModales() {
    const modalProd = document.getElementById("modal-producto");
    const modalCombo = document.getElementById("modal-combo");
    const modalVenta = document.getElementById("modal-venta");
    const formProducto = document.getElementById("form-producto");
    const formCombo = document.getElementById("form-combo");
    const formVenta = document.getElementById("form-venta");

    // Abridores safely
    const btnNuevoProd = document.getElementById("btn-nuevo-producto");
    const btnNuevoCombo = document.getElementById("btn-nuevo-combo");

    if (btnNuevoProd) btnNuevoProd.addEventListener("click", () => abrirModalProducto());
    if (btnNuevoCombo) btnNuevoCombo.addEventListener("click", () => abrirModalCombo());
    
    // Cerradores
    if (document.getElementById("btn-cerrar-modal-prod")) document.getElementById("btn-cerrar-modal-prod").addEventListener("click", () => modalProd.classList.replace("flex", "hidden"));
    if (document.getElementById("btn-cerrar-modal-combo")) document.getElementById("btn-cerrar-modal-combo").addEventListener("click", () => modalCombo.classList.replace("flex", "hidden"));
    if (document.getElementById("btn-cerrar-modal-venta")) document.getElementById("btn-cerrar-modal-venta").addEventListener("click", () => modalVenta.classList.replace("flex", "hidden"));

    // Guardar Producto
    if (formProducto) {
        formProducto.addEventListener("submit", (e) => {
            e.preventDefault();
            const nombre = document.getElementById("prod-nombre").value.trim();
            const costo = parseFloat(document.getElementById("prod-costo").value) || 0;
            const precio = parseFloat(document.getElementById("prod-precio").value) || 0;
            const stock = parseInt(document.getElementById("prod-stock").value) || 0;

            if (idElementoEdicion) {
                const index = productos.findIndex(p => p.id === idElementoEdicion);
                if (index !== -1) { productos[index] = { ...productos[index], nombre, costo, precio, stock }; }
            } else {
                productos.push({ id: "prod_" + Date.now(), nombre, costo, precio, stock, activo: true });
            }
            guardarProductosEnStorage();
            renderizarInventario();
            modalProd.classList.replace("flex", "hidden");
        });
    }

    // Añadir ítems al combo temporal
    const btnAgregarItemCombo = document.getElementById("btn-agregar-item-combo");
    if (btnAgregarItemCombo) {
        btnAgregarItemCombo.addEventListener("click", () => {
            const select = document.getElementById("combo-select-producto");
            const id = select.value;
            if (!id) return;
            const prod = productos.find(p => p.id === id);
            if (!prod) return;

            const existe = productosEnComboTemporal.find(p => p.id === id);
            if (existe) { existe.cantidad += 1; } else { productosEnComboTemporal.push({ id: prod.id, nombre: prod.nombre, costo: prod.costo, cantidad: 1 }); }
            actualizarTablaItemsCombo();
        });
    }

    const inputPrecioCombo = document.getElementById("combo-precio-venta");
    if (inputPrecioCombo) inputPrecioCombo.addEventListener("input", calcularGananciaComboLive);

    // Guardar Combo
    if (formCombo) {
        formCombo.addEventListener("submit", (e) => {
            e.preventDefault();
            if (productosEnComboTemporal.length === 0) return alert("Añade productos al combo.");
            const nombre = document.getElementById("combo-nombre").value.trim();
            const precioVenta = parseFloat(document.getElementById("combo-precio-venta").value) || 0;
            const costoTotal = productosEnComboTemporal.reduce((sum, p) => sum + (p.costo * p.cantidad), 0);

            if (idElementoEdicion) {
                const index = combos.findIndex(c => c.id === idElementoEdicion);
                if (index !== -1) { combos[index] = { ...combos[index], nombre, precioVenta, costoTotal, ganancia: precioVenta - costoTotal, productos: [...productosEnComboTemporal] }; }
            } else {
                combos.push({ id: "combo_" + Date.now(), nombre, precioVenta, costoTotal, ganancia: precioVenta - costoTotal, productos: [...productosEnComboTemporal], activo: true });
            }
            guardosCombosYActualizar();
            modalCombo.classList.replace("flex", "hidden");
        });
    }

    // PROCESAR VENTA
    if (formVenta) {
        formVenta.addEventListener("submit", (e) => {
            e.preventDefault();
            const itemSeleccionado = document.getElementById("venta-select-item").value;
            if (!itemSeleccionado) return;

            let costoTotalVenta = 0;
            let precioCobrado = parseFloat(document.getElementById("venta-precio-final").value) || 0;
            let nombreArticulo = "";

            if (itemSeleccionado.startsWith("prod_")) {
                const prod = productos.find(p => p.id === itemSeleccionado);
                if (!prod) return;
                if (prod.stock < 1) return alert(`No tienes stock suficiente de ${prod.nombre}`);
                
                prod.stock -= 1;
                costoTotalVenta = prod.costo;
                nombreArticulo = prod.nombre;

            } else if (itemSeleccionado.startsWith("combo_")) {
                const combo = combos.find(c => c.id === itemSeleccionado);
                if (!combo) return;

                for (let item of combo.productos) {
                    const pOriginal = productos.find(p => p.id === item.id);
                    if (!pOriginal || pOriginal.stock < item.cantidad) {
                        return alert(`Stock insuficiente de: ${item.nombre}`);
                    }
                }

                combo.productos.forEach(item => {
                    const pOriginal = productos.find(p => p.id === item.id);
                    if (pOriginal) pOriginal.stock -= item.cantidad;
                });

                costoTotalVenta = combo.costoTotal;
                nombreArticulo = `[Combo] ${combo.nombre}`;
            }

            transacciones.unshift({
                id: "tx_" + Date.now(),
                fecha: new Date().toLocaleString(),
                articulo: nombreArticulo,
                totalRecibido: precioCobrado,
                costoReal: costoTotalVenta,
                gananciaLimpia: precioCobrado - costoTotalVenta
            });

            guardarProductosEnStorage();
            guardarTransaccionesEnStorage();
            
            renderizarBalance();
            renderizarInventario();
            modalVenta.classList.replace("flex", "hidden");
            formVenta.reset();
        });
    }

    const selectVentaItem = document.getElementById("venta-select-item");
    if (selectVentaItem) {
        selectVentaItem.addEventListener("change", (e) => {
            const id = e.target.value;
            let precioSugerido = 0;
            if (id.startsWith("prod_")) {
                precioSugerido = productos.find(p => p.id === id)?.precio || 0;
            } else if (id.startsWith("combo_")) {
                precioSugerido = combos.find(c => c.id === id)?.precioVenta || 0;
            }
            document.getElementById("venta-precio-final").value = precioSugerido;
        });
    }
}

function abrirModalProducto(id = null) {
    idElementoEdicion = id;
    const form = document.getElementById("form-producto");
    document.querySelector("#modal-producto h4").textContent = id ? "Editar Producto" : "Añadir Nuevo Producto";
    form.reset();
    if (id) {
        const p = productos.find(p => p.id === id);
        if (p) {
            document.getElementById("prod-nombre").value = p.nombre;
            document.getElementById("prod-costo").value = p.costo;
            document.getElementById("prod-precio").value = p.precio;
            document.getElementById("prod-stock").value = p.stock;
        }
    }
    document.getElementById("modal-producto").classList.replace("hidden", "flex");
}

function abrirModalCombo(id = null) {
    idElementoEdicion = id;
    document.getElementById("form-combo").reset();
    productosEnComboTemporal = [];
    document.getElementById("items-combo-agregados").innerHTML = "";
    document.querySelector("#modal-combo h4").textContent = id ? "Editar Combo Kit" : "Armar Nuevo Combo";

    const select = document.getElementById("combo-select-producto");
    select.innerHTML = '<option value="">-- Selecciona un producto --</option>';
    productos.filter(p => p.activo).forEach(p => select.innerHTML += `<option value="${p.id}">${p.nombre} (Costo: $${p.costo})</option>`);

    if (id) {
        const c = combos.find(combo => combo.id === id);
        if (c) {
            document.getElementById("combo-nombre").value = c.nombre;
            document.getElementById("combo-precio-venta").value = c.precioVenta;
            productosEnComboTemporal = [...c.productos];
            actualizarTablaItemsCombo();
        }
    }
    document.getElementById("modal-combo").classList.replace("hidden", "flex");
}

function abrirModalVenta() {
    document.getElementById("form-venta").reset();
    const select = document.getElementById("venta-select-item");
    select.innerHTML = '<option value="">-- ¿Qué vas a vender? --</option>';

    if (combos.filter(c => c.activo).length > 0) {
        select.innerHTML += `<optgroup label="✨ COMBOS / KITS">`;
        combos.filter(c => c.activo).forEach(c => select.innerHTML += `<option value="${c.id}">${c.nombre} ($${c.precioVenta})</option>`);
        select.innerHTML += `</optgroup>`;
    }

    if (productos.filter(p => p.activo && p.stock > 0).length > 0) {
        select.innerHTML += `<optgroup label="💄 PRODUCTOS INDIVIDUALES">`;
        productos.filter(p => p.activo && p.stock > 0).forEach(p => select.innerHTML += `<option value="${p.id}">${p.nombre} (Stock: ${p.stock})</option>`);
        select.innerHTML += `</optgroup>`;
    }

    document.getElementById("modal-venta").classList.replace("hidden", "flex");
}

function actualizarTablaItemsCombo() {
    const contenedor = document.getElementById("items-combo-agregados");
    contenedor.innerHTML = "";
    let costoTotal = 0;
    productosEnComboTemporal.forEach((p, index) => {
        costoTotal += p.costo * p.cantidad;
        contenedor.innerHTML += `
            <div class="flex justify-between items-center bg-slate-100 p-2 rounded-lg text-[11px]">
                <div><p class="font-bold text-slate-700">${p.nombre}</p><p class="text-slate-400">${p.cantidad}x | Total: $${(p.costo * p.cantidad).toFixed(2)}</p></div>
                <button type="button" onclick="eliminarItemCombo(${index})" class="text-rose-500 font-bold px-1 cursor-pointer">✕</button>
            </div>`;
    });
    document.getElementById("combo-costo-calculado").textContent = `$${costoTotal.toFixed(2)}`;
    calcularGananciaComboLive();
}

window.eliminarItemCombo = function(index) { productosEnComboTemporal.splice(index, 1); actualizarTablaItemsCombo(); };

function calcularGananciaComboLive() {
    const costo = productosEnComboTemporal.reduce((sum, p) => sum + (p.costo * p.cantidad), 0);
    const venta = parseFloat(document.getElementById("combo-precio-venta").value) || 0;
    document.getElementById("combo-ganancia-calculada").textContent = `$${(venta - costo).toFixed(2)}`;
}

function guardosCombosYActualizar() { guardarCombosEnStorage(); renderizarInventario(); }

function renderizarBalance() {
    let totalVentas = 0;
    let totalCostos = 0;
    let gananciaNeta = 0;

    transacciones.forEach(tx => {
        totalVentas += tx.totalRecibido;
        totalCostos += tx.costoReal;
        gananciaNeta += tx.gananciaLimpia;
    });

    const labelGanancia = document.getElementById("bal-ganancia-neta");
    const labelVentas = document.getElementById("bal-total-ventas");
    const labelCostos = document.getElementById("bal-total-costos");

    if (labelGanancia) labelGanancia.textContent = `$${gananciaNeta.toFixed(2)}`;
    if (labelVentas) labelVentas.textContent = `+$${totalVentas.toFixed(2)}`;
    if (labelCostos) labelCostos.textContent = `-$${totalCostos.toFixed(2)}`;

    const contenedorHistorial = document.getElementById("lista-transacciones");
    if (!contenedorHistorial) return;

    if (transacciones.length === 0) {
        contenedorHistorial.innerHTML = `
            <div class="text-center py-6 text-xs text-slate-400">
                <i data-lucide="receipt" class="w-6 h-6 mx-auto mb-1 opacity-40"></i> No hay registros de ventas hoy.
            </div>`;
        lucide.createIcons();
        return;
    }

    let html = '<div class="space-y-2">';
    transacciones.forEach(tx => {
        html += `
            <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex justify-between items-center text-xs">
                <div>
                    <p class="font-bold text-slate-800">${tx.articulo}</p>
                    <p class="text-[10px] text-slate-400">${tx.fecha}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold text-emerald-600">+$${tx.totalRecibido.toFixed(2)}</p>
                    <p class="text-[10px] text-slate-400">Ganancia: +$${tx.gananciaLimpia.toFixed(2)}</p>
                </div>
            </div>`;
    });
    html += '</div>';
    contenedorHistorial.innerHTML = html;
    lucide.createIcons();
}

window.editarProducto = (id) => abrirModalProducto(id);
window.editarCombo = (id) => abrirModalCombo(id);
window.conmutarEstadoProducto = (id) => { const i = productos.findIndex(p => p.id === id); if(i!==-1){ productos[i].activo = !productos[i].activo; guardarProductosEnStorage(); renderizarInventario(); } };
window.conmutarEstadoCombo = (id) => { const i = combos.findIndex(c => c.id === id); if(i!==-1){ combos[i].activo = !combos[i].activo; guardarCombosEnStorage(); renderizarInventario(); } };
window.eliminarProducto = (id) => { if(confirm("¿Eliminar permanentemente?")){ productos = productos.filter(p => p.id !== id); guardarProductosEnStorage(); renderizarInventario(); } };
window.eliminarCombo = (id) => { if(confirm("¿Eliminar combo?")){ combos = combos.filter(c => c.id !== id); guardarCombosEnStorage(); renderizarInventario(); } };

function renderizarInventario() {
    const contenedor = document.getElementById("lista-inventario");
    if (!contenedor) return;
    if (productos.length === 0 && combos.length === 0) {
        contenedor.innerHTML = `<div class="bg-white p-8 rounded-xl border text-center text-slate-400 text-sm w-full"><i data-lucide="box" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>Inventario vacío.</div>`;
        return;
    }
    let html = '';
    if (combos.length > 0) {
        html += `<h4 class="text-xs font-black uppercase text-purple-400 tracking-wider mt-2 mb-1">Combos Armados (${combos.length})</h4>`;
        combos.forEach(c => {
            html += `
                <div class="p-4 rounded-xl border ${c.activo ? 'bg-gradient-to-r from-fuchsia-50 to-purple-50 border-purple-100' : 'bg-slate-50 border-slate-200 opacity-60'}">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${c.activo ? 'bg-purple-600 text-white' : 'bg-slate-400 text-white'}">${c.activo ? 'Combo Activo' : 'Inactivo'}</span>
                            <h4 class="font-bold text-slate-800 text-sm mt-1">${c.nombre}</h4>
                            <p class="text-xs text-slate-500">Costo: $${c.costoTotal.toFixed(2)} | Venta: <span class="font-bold text-purple-700">$${c.precioVenta.toFixed(2)}</span></p>
                            <p class="text-xs font-bold text-emerald-600">Ganancia: +$${c.ganancia.toFixed(2)}</p>
                        </div>
                        <div class="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-100 shadow-xs">
                            <button onclick="editarCombo('${c.id}')" class="text-slate-500 hover:text-purple-700 p-1 cursor-pointer"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
                            <button onclick="conmutarEstadoCombo('${c.id}')" class="text-slate-500 p-1 cursor-pointer"><i data-lucide="${c.activo ? 'eye' : 'eye-off'}" class="w-3.5 h-3.5"></i></button>
                            <button onclick="eliminarCombo('${c.id}')" class="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>
                </div>`;
        });
    }
    if (productos.length > 0) {
        html += `<h4 class="text-xs font-black uppercase text-slate-400 tracking-wider mt-4 mb-1">Productos Individuales (${productos.length})</h4>`;
        productos.forEach(p => {
            html += `
                <div class="bg-white p-4 rounded-xl border ${p.activo ? 'border-slate-100 shadow-xs' : 'border-slate-200 bg-slate-50/70 opacity-60'} flex justify-between items-center">
                    <div>
                        <div class="flex items-center gap-2"><h4 class="font-bold text-slate-800 text-sm">${p.nombre}</h4>${!p.activo ? '<span class="text-[9px] bg-slate-300 text-slate-600 px-1.5 py-0.2 rounded font-bold">Inactivo</span>' : ''}</div>
                        <p class="text-xs text-slate-400">Costo: $${p.costo.toFixed(2)} | Venta: $${p.precio.toFixed(2)}</p>
                        <p class="text-xs font-semibold text-purple-600">Ganancia: +$${(p.precio - p.costo).toFixed(2)}</p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded-md ${p.stock > 0 && p.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${p.stock} Unds</span>
                        <div class="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100 shadow-xs">
                            <button onclick="editarProducto('${p.id}')" class="text-slate-500 p-1 cursor-pointer"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
                            <button onclick="conmutarEstadoProducto('${p.id}')" class="text-slate-500 p-1 cursor-pointer"><i data-lucide="${p.activo ? 'eye' : 'eye-off'}" class="w-3.5 h-3.5"></i></button>
                            <button onclick="eliminarProducto('${p.id}')" class="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>
                </div>`;
        });
    }
    contenedor.innerHTML = html;
    lucide.createIcons();
}
