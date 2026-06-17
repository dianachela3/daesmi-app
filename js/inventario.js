let productos = [];
let combos = [];
let productosSeleccionadosEnCombo = [];
let editandoProductoId = null;
let editandoComboId = null;
let editandoComboIdx = null;

window.addEventListener('load', () => {
    setTimeout(() => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            window.db = firebase.firestore();

            protegerPantalla(initSincronizacionInventario); 

        } else {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('app-content').style.display = 'flex';

            console.warn("⚠️ Sin conexión a Firebase. Cargando datos locales...");
            alert("Estás en modo sin conexión. Los cambios nuevos no se guardarán en la nube.");

            const inventarioLocal = localStorage.getItem('daesmi_inventario_cache');
            if (inventarioLocal) {
                renderizarTabla(JSON.parse(inventarioLocal));
            } else {
                document.getElementById('productsTableBody').innerHTML = 
                    '<tr><td colspan="6">No hay datos en caché. Verifica tu conexión.</td></tr>';
            }

            const botonesGuardar = document.querySelectorAll('.btn-submit');
            botonesGuardar.forEach(btn => btn.disabled = true);
            botonesGuardar.forEach(btn => btn.innerText = "Modo Offline (Solo Lectura)");
        }
    }, 500); 
});

window.cerrarSesionPlataforma = function() {
    if(confirm("¿Deseas cerrar sesión en MyLuR OS?")) {
        firebase.auth().signOut().then(() => {
            window.location.href = "index.html";
        }).catch(err => console.error("Error al cerrar sesión: ", err));
    }
};

function initSincronizacionInventario() {
    window.db.collection("productos")
        .onSnapshot((snapshot) => {
            productos = [];
            snapshot.forEach((doc) => {
                let data = doc.data();
                data.id = doc.id;
                productos.push(data);
            });
            renderProductos();
            actualizarMetricas();
            renderChecklistProductos();
        }, error => console.error("Error en Productos: ", error));

    window.db.collection("combos")
        .onSnapshot((snapshot) => {
            combos = [];
            snapshot.forEach((doc) => {
                let data = doc.data();
                data.id = doc.id;
                combos.push(data);
            });
            renderCombos();
        }, error => console.error("Error en Combos: ", error));

    setupFormularios();
}

function initInterfacesLocales() {
    renderProductos();
    renderCombos();
    actualizarMetricas();
    renderChecklistProductos();
    setupFormularios();
}

function renderProductos() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    if (productos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No hay productos registrados.</td></tr>`;
        return;
    }

    tbody.innerHTML = productos.map((prod, index) => {
        let stockEstilo = 'color: var(--color-text-main);';
        let badgeAlerta = '';

        if (prod.stock === 0) {
            stockEstilo = 'color: #DC2626; font-weight: 700;';
            badgeAlerta = '<br><span style="background: #FEF2F2; color: #DC2626; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">⚠️ AGOTADO</span>';
        } else if (prod.stock <= 3) {
            stockEstilo = 'color: #D97706; font-weight: 700;';
            badgeAlerta = '<br><span style="background: #FFFBEB; color: #D97706; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">⏳ STOCK BAJO</span>';
        }

        return `
            <tr>
                <td><strong>${prod.title}</strong><br><small style="color: var(--color-text-muted);">${prod.desc || ''}</small></td>
                <td><span class="badge ${prod.origin}">${prod.origin.toUpperCase()}</span></td>
                <td>
                    <strong style="${stockEstilo}">${prod.stock} und</strong>
                    ${badgeAlerta}
                </td>
                <td>$${(Number(prod.cost) || 0).toLocaleString()}</td>
                <td>$${(Number(prod.price) || 0).toLocaleString()}</td>
                <td>$${(Number(prod.discount || 0)).toLocaleString()}</td>
                <td>
                    <button class="btn-action-edit" onclick="prepararEditarProducto(${index})">📝</button>
                    <button class="btn-logout" style="padding: 4px 8px; border-color: #EF4444; color: #EF4444; background: none;" onclick="eliminarProducto('${prod.id}', ${index})">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderCombos() {
    const tbody = document.getElementById('combosTableBody');
    if (!tbody) return;

    if (combos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No has creado combos todavía.</td></tr>`;
        return;
    }

    tbody.innerHTML = combos.map((combo, index) => {
        const gananciaNeta = (Number(combo.finalPrice) || 0) - (Number(combo.totalCost) || 0);
        return `
            <tr>
                <td><strong>${combo.name}</strong></td>
                <td><small style="color: var(--color-text-muted);">${(combo.items || []).join(', ')}</small></td>
                <td>$${(Number(combo.totalCost) || 0).toLocaleString()}</td>
                <td><strong style="color: var(--color-primary);">$${(Number(combo.finalPrice) || 0).toLocaleString()}</strong></td>
                <td style="color: ${gananciaNeta >= 0 ? '#059669' : '#DC2626'}; font-weight: 600;">
                    $${gananciaNeta.toLocaleString()}
                </td>
                <td>
                    <button class="btn-action-edit" onclick="prepararEditarCombo(${index})">📝</button>
                    <button class="btn-logout" style="padding: 4px 8px; border-color: #EF4444; color: #EF4444; background: none;" onclick="eliminarCombo('${combo.id}', ${index})">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderChecklistProductos() {
    const datalist = document.getElementById('productsDatalist');
    if (!datalist) return;

    datalist.innerHTML = productos.map((prod, index) => `
        <option value="${prod.title} (${prod.origin === 'colaboracion' ? '🤝 Colab' : '📦 Propio'}) [Stock: ${prod.stock}]" data-index="${index}"></option>
    `).join('');
}

window.agregarProductoAlCombo = function() {
    const input = document.getElementById('comboProductSelector');
    const qtyInput = document.getElementById('comboProductQty');
    const val = input.value;
    const cantidadAsignar = Number(qtyInput.value) || 1;
    
    const option = document.querySelector(`#productsDatalist option[value="${val}"]`);
    if (!option) {
        alert("Por favor selecciona un producto válido de la lista.");
        return;
    }

    const index = option.getAttribute('data-index');
    const prod = productos[index];

    if (prod.stock <= 0) {
        alert(`No puedes agregar "${prod.title}" porque no tiene cantidades disponibles (Stock: 0).`);
        return;
    }
    if (cantidadAsignar > prod.stock) {
        alert(`No puedes agregar ${cantidadAsignar} unidades. Solo tienes ${prod.stock} disponibles en stock.`);
        return;
    }

    const existente = productosSeleccionadosEnCombo.find(item => item.productIndex === index);
    if (existente) {
        if ((existente.quantity + cantidadAsignar) > prod.stock) {
            alert(`La suma total de unidades en el combo supera las ${prod.stock} unidades que tienes en stock.`);
            return;
        }
        existente.quantity += cantidadAsignar;
    } else {
        productosSeleccionadosEnCombo.push({
            productIndex: index,
            title: prod.title,
            origin: prod.origin,
            cost: Number(prod.cost),
            price: Number(prod.price),
            quantity: cantidadAsignar
        });
    }
    
    input.value = '';
    qtyInput.value = '1';

    renderProductosSeleccionadosCombo();
    calcularPreciosDinamicosCombo();
};

window.quitarProductoDelCombo = function(idx) {
    productosSeleccionadosEnCombo.splice(idx, 1);
    renderProductosSeleccionadosCombo();
    calcularPreciosDinamicosCombo();
};

function renderProductosSeleccionadosCombo() {
    const container = document.getElementById('selectedComboProductsList');
    if (!container) return;

    if (productosSeleccionadosEnCombo.length === 0) {
        container.innerHTML = `<span style="color: var(--color-text-muted); font-size: 13px;">Ningún producto añadido al combo todavía.</span>`;
        return;
    }

    container.innerHTML = productosSeleccionadosEnCombo.map((item, idx) => {
        const costoSubtotal = item.cost * item.quantity;
        const ventaSubtotal = item.price * item.quantity;
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 10px; border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--color-border); font-size: 13px;">
                <div style="display: flex; flex-direction: column;">
                    <strong>${item.title} <span style="color: var(--color-primary);">x${item.quantity}</span></strong>
                    <span style="font-size: 11px; color: var(--color-text-muted);">${item.origin === 'colaboracion' ? '🤝 Colaboración' : '📦 Propio'}</span>
                </div>
                <div style="display: flex; gap: 12px; align-items: center; text-align: right;">
                    <div style="display: flex; flex-direction: column; font-size: 11px;">
                        <span style="color: var(--color-text-muted);">Costo: $${costoSubtotal.toLocaleString()}</span>
                        <span style="color: var(--color-primary); font-weight: 500;">Venta: $${ventaSubtotal.toLocaleString()}</span>
                    </div>
                    <button type="button" style="background:none; border:none; color:#EF4444; cursor:pointer;" onclick="quitarProductoDelCombo(${idx})">❌</button>
                </div>
            </div>
        `;
    }).join('');
}

window.calcularPreciosDinamicosCombo = function() {
    let costoAcumulado = 0;
    let retencionColab = 0;
    let precioSugeridoPublico = 0;

    productosSeleccionadosEnCombo.forEach(item => {
        costoAcumulado += (item.cost * item.quantity);
        precioSugeridoPublico += (item.price * item.quantity);
        
        if (item.origin === 'colaboracion') {
            retencionColab += (item.cost * item.quantity);
        }
    });

    document.getElementById('summaryCost').textContent = `$${costoAcumulado.toLocaleString()}`;
    document.getElementById('summaryColabProtect').textContent = `$${retencionColab.toLocaleString()}`;
    document.getElementById('summarySuggested').textContent = `$${precioSugeridoPublico.toLocaleString()}`;
};

function setupFormularios() {
    const productForm = document.getElementById('productForm');
    if (productForm && !productForm.dataset.listenerAttached) {
        productForm.dataset.listenerAttached = "true";
        productForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const datosProd = {
                title: document.getElementById('prodTitle').value,
                desc: document.getElementById('prodDesc').value,
                origin: document.getElementById('prodOrigin').value,
                stock: Number(document.getElementById('prodStock').value),
                cost: Number(document.getElementById('prodCost').value),
                price: Number(document.getElementById('prodPrice').value),
                discount: Number(document.getElementById('prodDiscount').value) || 0,
                fechaActualizacion: new Date()
            };

            if (window.db) {
                if (editandoProductoId !== null) {
                    window.db.collection("productos").doc(editandoProductoId).update(datosProd)
                    .then(() => {
                        editandoProductoId = null;
                        limpiarYFermarProductoForm(productForm);
                    }).catch(err => console.error("Error al actualizar producto en la nube: ", err));
                } else {
                    window.db.collection("productos").add(datosProd)
                    .then(() => limpiarYFermarProductoForm(productForm))
                    .catch(err => console.error("Error al crear producto en la nube: ", err));
                }
            } else {
                if (editandoProductoIdx !== null) {
                    productos[editandoProductoIdx] = datosProd;
                    editandoProductoIdx = null; 
                } else {
                    productos.push(datosProd);
                }
                localStorage.setItem('daesmi_productos', JSON.stringify(productos));
                limpiarYFermarProductoForm(productForm);
                initInterfacesLocales();
            }
        });
    }

    const comboForm = document.getElementById('comboForm');
    if (comboForm && !comboForm.dataset.listenerAttached) {
        comboForm.dataset.listenerAttached = "true";
        comboForm.addEventListener('submit', (e) => {
            e.preventDefault();

            let itemsDetalle = [];
            let costoTotalCombo = 0;
            let costoColabRetenido = 0;

            if (typeof editandoComboId !== 'undefined' && editandoComboId !== null && productosSeleccionadosEnCombo.length === 0 && window.db) {
                const matchCombo = combos.find(c => c.id === editandoComboId);
                if (matchCombo) {
                    itemsDetalle = matchCombo.items || [];
                    costoTotalCombo = matchCombo.totalCost || 0;
                    costoColabRetenido = matchCombo.colabProtect || 0;
                }
            } else if (productosSeleccionadosEnCombo.length === 0) {
                alert("Por favor selecciona al menos un producto para el combo.");
                return;
            } else {
                productosSeleccionadosEnCombo.forEach(item => {
                    itemsDetalle.push(`${item.title} (x${item.quantity})`);
                    costoTotalCombo += (item.cost * item.quantity);
                    if (item.origin === 'colaboracion') {
                        costoColabRetenido += (item.cost * item.quantity);
                    }
                });
            }

            const datosCombo = {
                name: document.getElementById('comboName').value,
                items: itemsDetalle,
                totalCost: costoTotalCombo,
                colabProtect: costoColabRetenido,
                finalPrice: Number(document.getElementById('comboFinalPrice').value),
                fechaActualizacion: new Date()
            };

            if (window.db) {
                if (editandoComboId !== null) {
                    window.db.collection("combos").doc(editandoComboId).update(datosCombo)
                    .then(() => {
                        editandoComboId = null;
                        limpiarYFermarComboForm(comboForm);
                    }).catch(err => console.error("Error al actualizar combo: ", err));
                } else {
                    window.db.collection("combos").add(datosCombo)
                    .then(() => limpiarYFermarComboForm(comboForm))
                    .catch(err => console.error("Error al crear combo: ", err));
                }
            } else {
                combos.push(datosCombo);
                localStorage.setItem('daesmi_combos', JSON.stringify(combos));
                limpiarYFermarComboForm(comboForm);
                initInterfacesLocales();
            }
        });
    }
}

function limpiarYFermarProductoForm(form) {
    form.reset();
    document.getElementById('modalProducto').hidden = true;
    const submitBtn = document.querySelector('#productForm .btn-submit');
    if (submitBtn) submitBtn.textContent = "Guardar Producto";
}

function limpiarYFermarComboForm(form) {
    form.reset();
    document.getElementById('modalCombo').hidden = true;
    const submitBtn = document.querySelector('#comboForm .btn-submit');
    if (submitBtn) submitBtn.textContent = "Guardar Combo";

    productosSeleccionadosEnCombo = [];
    document.getElementById('summaryCost').textContent = "$0";
    document.getElementById('summaryColabProtect').textContent = "$0";
    document.getElementById('summarySuggested').textContent = "$0";
    document.getElementById('selectedComboProductsList').innerHTML = `<span style="color: var(--color-text-muted); font-size: 13px;">Ningún producto añadido al combo todavía.</span>`;
}

function actualizarMetricas() {
    const invPropiaEl = document.getElementById('invPropia');
    const invColabEl = document.getElementById('invColab');
    
    const inversionTotalPropia = productos
        .filter(p => p.origin === 'propio')
        .reduce((sum, p) => sum + (Number(p.cost || 0) * Number(p.stock || 0)), 0);

    if (invPropiaEl) {
        invPropiaEl.textContent = `$${inversionTotalPropia.toLocaleString()}`;
    }

    const inversionTotalColab = productos
        .filter(p => p.origin === 'colaboracion')
        .reduce((sum, p) => sum + (Number(p.cost || 0) * Number(p.stock || 0)), 0);

    if (invColabEl) {
        invColabEl.textContent = `$${inversionTotalColab.toLocaleString()}`;
    }
}

window.eliminarProducto = function(idFirebase, index) {
    if (confirm("¿Seguro que deseas eliminar este producto?")) {
        if (window.db && idFirebase) {
            window.db.collection("productos").doc(idFirebase).delete()
            .catch(err => console.error("Error al eliminar producto: ", err));
        } else {
            productos.splice(index, 1);
            localStorage.setItem('daesmi_productos', JSON.stringify(productos));
            initInterfacesLocales();
        }
    }
};

window.eliminarCombo = function(idFirebase, index) {
    if (confirm("¿Seguro que deseas eliminar este combo/kit?")) {
        if (window.db && idFirebase) {
            window.db.collection("combos").doc(idFirebase).delete()
            .catch(err => console.error("Error al eliminar combo: ", err));
        } else {
            combos.splice(index, 1);
            localStorage.setItem('daesmi_combos', JSON.stringify(combos));
            initInterfacesLocales();
        }
    }
};

window.prepararEditarProducto = function(index) {
    const prod = productos[index];
    if (window.db) {
        editandoProductoId = prod.id;
    } else {
        editandoProductoIdx = index;
    }

    document.getElementById('prodTitle').value = prod.title;
    document.getElementById('prodDesc').value = prod.desc || '';
    document.getElementById('prodOrigin').value = prod.origin;
    document.getElementById('prodStock').value = prod.stock;
    document.getElementById('prodCost').value = prod.cost;
    document.getElementById('prodPrice').value = prod.price;
    document.getElementById('prodDiscount').value = prod.discount || 0;

    const submitBtn = document.querySelector('#productForm .btn-submit');
    if (submitBtn) submitBtn.textContent = "Actualizar Producto";

    document.getElementById('modalProducto').hidden = false;
};

window.prepararEditarCombo = function(index) {
    const combo = combos[index];
    if (window.db) {
        editandoComboId = combo.id;
    } else {
        editandoComboIdx = index;
    }

    document.getElementById('comboName').value = combo.name;
    document.getElementById('comboFinalPrice').value = combo.finalPrice;
    
    productosSeleccionadosEnCombo = [];
    document.getElementById('summaryCost').textContent = `$${(Number(combo.totalCost) || 0).toLocaleString()}`;
    document.getElementById('summaryColabProtect').textContent = `$${(Number(combo.colabProtect) || 0).toLocaleString()}`;
    document.getElementById('summarySuggested').textContent = "Asignado en creación";
    document.getElementById('selectedComboProductsList').innerHTML = `
        <span style="color: #6B7280; font-size: 12px; font-style: italic;">
            Componentes iniciales: ${(combo.items || []).join(', ')}.<br>
            Agrega nuevos si deseas sobreescribir la estructura de insumos del combo.
        </span>`;

    const submitBtn = document.querySelector('#comboForm .btn-submit');
    if (submitBtn) submitBtn.textContent = "Actualizar Combo";

    document.getElementById('modalCombo').hidden = false;
};