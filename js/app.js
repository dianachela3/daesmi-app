let transacciones = [];
let productos = [];
let combos = [];
let editandoTxIndex = null;
let transaccionesFiltradas = [];

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            window.db = firebase.firestore();

            protegerPantalla(() => {
                initSincronizacionNube();
                setupEventos();
                console.log("✅ DAESMI OS - Sincronización iniciada.");
            });
        } else {
            console.warn("⚠️ Firebase no disponible, modo local activo.");
        }
    }, 500);
});

window.cerrarSesionPlataforma = function() {
    if(confirm("¿Deseas cerrar sesión en DAESMI OS?")) {
        firebase.auth().signOut().then(() => {
            window.location.href = "index.html";
        }).catch(err => console.error("Error al cerrar sesión: ", err));
    }
};

function initSincronizacionNube() {
    window.db.collection("transacciones")
        .onSnapshot((snapshot) => {
            transacciones = [];
            snapshot.forEach((doc) => {
                let data = doc.data();
                data.id = doc.id;
                transacciones.push(data);               
            });
            poblarSelectorMeses();
            aplicarFiltros();
            renderTransacciones();
            calcularMetricasFinancieras();
        }, (error) => console.error("Error en Snapshot Transacciones: ", error));

    window.db.collection("productos")
        .onSnapshot((snapshot) => {
            productos = [];
            snapshot.forEach((doc) => {
                let data = doc.data();
                data.id = doc.id;
                productos.push(data);
            });
            cargarDatalistVentas();
        }, (error) => console.error("Error en Snapshot Productos: ", error));

    window.db.collection("combos")
        .onSnapshot((snapshot) => {
            combos = [];
            snapshot.forEach((doc) => {
                let data = doc.data();
                data.id = doc.id;
                combos.push(data);
            });
            cargarDatalistVentas();
        }, (error) => console.error("Error en Snapshot Combos: ", error));
}

function setupFormulariosYModales() {
    window.abrirModalTransaccion = function() {
        const modal = document.getElementById('modalTransaction');
        if(modal) modal.hidden = false;
    };
}

function initFinanzas() {
    const userEl = document.getElementById('sessionUser');
    if (userEl) userEl.textContent = "Administradora";

    setupEventos();
    renderTransacciones();
    calcularMetricasFinancieras();
    cargarDatalistVentas();
    ajustarFormularioPorTipo();
}

function setupEventos() {
    const modal = document.getElementById('modalTransaction');
    const btnAbrir = document.getElementById('btnRegistrarMovimiento') || document.querySelector('.btn-primary-sm');
    const btnCerrar = document.getElementById('closeModal');
    const form = document.getElementById('transactionForm');

    if (btnAbrir) btnAbrir.onclick = (e) => { e.preventDefault(); if (modal) modal.hidden = false; ajustarFormularioPorTipo(); };
    if (btnCerrar) btnCerrar.onclick = (e) => { e.preventDefault(); if (modal) modal.hidden = true; if (form) form.reset(); };

    const inputSelector = document.getElementById('txProductSelector');
    if (inputSelector) {
        inputSelector.addEventListener('input', (e) => {
            const val = e.target.value;
            const option = document.querySelector(`#finanzasDatalist option[value="${val.replace(/"/g, '\\"')}"]`);
            if (option) {
                document.getElementById('txAmount').value = option.getAttribute('data-price');
                document.getElementById('txConcept').value = `Venta ${option.getAttribute('data-type')}: ${option.getAttribute('data-title')}`;
                document.getElementById('txCategory').value = "Ventas";
            }
        });
    }

    if (form) {
        form.onsubmit = (e) => { e.preventDefault(); procesarNuevoMovimiento(); };
    }
}

window.ajustarFormularioPorTipo = function() {
    const typeEl = document.getElementById('txType');
    const seccionProducto = document.getElementById('seccionVentaProducto');
    const categoriaSelect = document.getElementById('txCategory');

    if (!typeEl) return; 
    const type = typeEl.value;

    if (type === 'expense') {
        if (seccionProducto) seccionProducto.style.display = 'none';
        if (categoriaSelect) categoriaSelect.value = 'Compra de productos';
    } else {
        if (seccionProducto) seccionProducto.style.display = 'block';
        if (categoriaSelect) categoriaSelect.value = 'Ventas';
    }
};

function cargarDatalistVentas() {
    const datalist = document.getElementById('finanzasDatalist');
    if (!datalist) return;

    let opcionesHTML = [];

    productos.forEach((prod, idx) => {
        if (Number(prod.stock) > 0) {
            opcionesHTML.push(`
                <option value="📦 [PRODUCTO] ${prod.title} ($${Number(prod.price || 0).toLocaleString()})" 
                        data-type="producto" data-index="${idx}" data-price="${prod.price || 0}" data-title="${prod.title}"></option>
            `);
        }
    });

    combos.forEach((combo, idx) => {
        opcionesHTML.push(`
            <option value="✨ [COMBO] ${combo.name} ($${Number(combo.finalPrice || 0).toLocaleString()})" 
                    data-type="combo" data-index="${idx}" data-price="${combo.finalPrice || 0}" data-title="${combo.name}"></option>
        `);
    });

    datalist.innerHTML = opcionesHTML.join('');
}

function procesarNuevoMovimiento() {
    const type = document.getElementById('txType').value;
    const concepto = document.getElementById('txConcept').value;
    const monto = Number(document.getElementById('txAmount').value);
    const categoria = document.getElementById('txCategory').value;
    const selectorVal = document.getElementById('txProductSelector').value;

    let colabExtract = 0; 
    let costoPropioExtract = 0;
    let vinculo = null;

    if (editandoTxIndex !== null) {
        const idDocumento = transacciones[editandoTxIndex].id;
        
        window.db.collection("transacciones").doc(idDocumento).update({
            concepto: concepto,
            monto: monto,
            categoria: categoria,
            tipo: type
        })
        .then(() => {
            console.log("Transacción actualizada en Firebase");
            editandoTxIndex = null;
        })
        .catch((error) => console.error("Error al actualizar: ", error));

    } else {
        if (type === 'income' && selectorVal) {
            const option = document.querySelector(`#finanzasDatalist option[value="${selectorVal.replace(/"/g, '\\"')}"]`);
            if (option) {
                const itemType = option.getAttribute('data-type');
                const itemIdx = Number(option.getAttribute('data-index'));
                
                vinculo = { type: itemType, index: itemIdx };

                if (itemType === 'producto') {
                    const prod = productos[itemIdx];
                    if (prod) {
                        if (prod.origin === 'colaboracion') colabExtract = Number(prod.cost || 0);
                        else costoPropioExtract = Number(prod.cost || 0);

                        const nuevoStock = Math.max(0, Number(prod.stock || 0) - 1);
                        window.db.collection("productos").doc(prod.id).update({ stock: nuevoStock });
                    }
                } 
                else if (itemType === 'combo') {
                    const combo = combos[itemIdx];
                    if (combo) {
                        colabExtract = Number(combo.colabProtect || 0);
                        costoPropioExtract = Math.max(0, Number(combo.totalCost || 0) - colabExtract);

                        if (combo.items && combo.items.length > 0) {
                            combo.items.forEach(itemStr => {
                                const nombreProd = itemStr.split(' (x')[0];
                                const matchCantidad = itemStr.match(/\(x(\d+)\)/);
                                const cantidadADescontar = matchCantidad ? parseInt(matchCantidad[1]) : 1;

                                const prodEnInv = productos.find(p => p.title === nombreProd);
                                if (prodEnInv) {
                                    const nuevoStockComponente = Math.max(0, Number(prodEnInv.stock || 0) - cantidadADescontar);
                                    window.db.collection("productos").doc(prodEnInv.id).update({ stock: nuevoStockComponente });
                                }
                            });
                        }
                    }
                }
            }
        }

        const nuevaTx = {
            fecha: new Date().toLocaleDateString('es-CO'),
            fechaTimestamp: new Date(), 
            concepto: concepto,
            categoria: categoria,
            tipo: type,
            monto: monto,
            colabRetencion: colabExtract,
            costoPropio: costoPropioExtract,
            itemVinculado: vinculo
        };

        window.db.collection("transacciones").add(nuevaTx)
        .then(() => console.log("Transacción registrada con éxito en Firebase"))
        .catch((error) => console.error("Error al añadir transacción: ", error));
    }

    const form = document.getElementById('transactionForm');
    if (form) form.reset();
    document.getElementById('modalTransaction').hidden = true;
    
    const submitBtn = document.querySelector('#transactionForm .btn-submit');
    if (submitBtn) submitBtn.textContent = "Guardar Registro";
}

function renderTransacciones(datos = transacciones) {
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;

    if (!datos || datos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No hay movimientos registrados para este periodo.</td></tr>`;
        return;
    }

    tbody.innerHTML = datos.map((tx, index) => {
        let fechaFormateada = '';
        if (tx.fecha) {
            if (typeof tx.fecha.toDate === 'function') {
                fechaFormateada = tx.fecha.toDate().toLocaleDateString();
            } else if (tx.fecha.seconds) {
                fechaFormateada = new Date(tx.fecha.seconds * 1000).toLocaleDateString();
            } else {
                fechaFormateada = String(tx.fecha);
            }
        } else {
            fechaFormateada = 'Sin fecha';
        }

        return `
            <tr>
                <td><span class="date-badge">${fechaFormateada}</span></td>
                <td><strong>${tx.concepto || 'Sin concepto'}</strong><br><small style="color: var(--color-text-muted);">${tx.categoria || 'General'}</small></td>
                <td><span class="badge" style="background-color: ${tx.tipo === 'income' ? '#E0F2FE':'#FEF2F2'}; color: ${tx.tipo === 'income' ? '#0369A1':'#DC2626'}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">
                    ${tx.tipo === 'income' ? 'INGRESO' : 'GASTO'}
                </span></td>
                <td>
                    <strong class="${tx.tipo === 'income' ? 'amount-income' : 'amount-expense'}">
                        ${tx.tipo === 'income' ? '+' : '-'}${(Number(tx.monto || 0)).toLocaleString('es-CO')}
                    </strong>
                </td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-logout" style="padding: 4px 8px; border-color: #6B7280; color: #4B5563; background: none;" onclick="prepararEditarTransaccion(${index})">📝</button>
                        <button class="btn-logout" style="padding: 4px 8px; border-color: #EF4444; color: #EF4444; background: none;" onclick="eliminarTransaccion(${index})">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function calcularMetricasFinancieras(datos = transacciones) {
    let totalVendido = 0;
    let saldoGanancias = 0;
    let saldoColaboraciones = 0;
    let saldoCostoPropio = 0;

    datos.forEach(tx => {
        const monto = Number(tx.monto || 0);

        if (tx.tipo === 'income') {
            totalVendido += monto;
            
            saldoColaboraciones += Number(tx.colabRetencion || 0);
            saldoCostoPropio += Number(tx.costoPropio || 0);
            
            let restoParaGanancias = monto - Number(tx.colabRetencion || 0) - Number(tx.costoPropio || 0);
            saldoGanancias += restoParaGanancias;

        } else if (tx.tipo === 'expense') {
            if (tx.categoria === 'Retiro de ganancias') {
                saldoGanancias -= monto;
            } else if (tx.categoria === 'Pago a productos de colaboradores') {
                saldoColaboraciones -= monto;
            } else if (tx.categoria === 'Compra de productos') {
                saldoCostoPropio -= monto;
            } else {
                saldoGanancias -= monto;
            }
        }
    });

    const setElement = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = `$${val.toLocaleString('es-CO')}`;
    };

    setElement('totalVendido', totalVendido);
    setElement('totalColaboracion', saldoColaboraciones);
    setElement('totalCostoPropio', saldoCostoPropio);
    setElement('totalGanancias', saldoGanancias);
    
    const elGanancias = document.getElementById('totalGanancias');
    if (elGanancias) {
        elGanancias.style.color = saldoGanancias >= 0 ? '#7C3AED' : '#DC2626';
    }
}

window.eliminarTransaccion = function(index) {
    if (confirm("¿Seguro que deseas eliminar este registro? El stock de los productos vendidos se restaurará de forma automática en la nube.")) {
        const tx = transacciones[index];

        if (tx.tipo === 'income' && tx.itemVinculado) {
            if (tx.itemVinculado.type === 'producto') {
                const prod = productos[tx.itemVinculado.index];
                if (prod) {
                    window.db.collection("productos").doc(prod.id).update({ stock: Number(prod.stock || 0) + 1 });
                }
            } 
            else if (tx.itemVinculado.type === 'combo') {
                if (tx.concepto.includes("Venta Combo:")) {
                    const comboVendido = combos[tx.itemVinculado.index];
                    if (comboVendido && comboVendido.items) {
                        comboVendido.items.forEach(itemStr => {
                            const nombreProd = itemStr.split(' (x')[0];
                            const matchCantidad = itemStr.match(/\(x(\d+)\)/);
                            const cantidadDevolver = matchCantidad ? parseInt(matchCantidad[1]) : 1;

                            const prodInv = productos.find(p => p.title === nombreProd);
                            if (prodInv) {
                                window.db.collection("productos").doc(prodInv.id).update({ stock: Number(prodInv.stock || 0) + cantidadDevolver });
                            }
                        });
                    }
                }
            }
        }

        window.db.collection("transacciones").doc(tx.id).delete()
        .then(() => console.log("Documento eliminado de la nube"))
        .catch((error) => console.error("Error al eliminar de Firebase: ", error));
    }
};

window.prepararEditarTransaccion = function(index) {
    const tx = transacciones[index];
    editandoTxIndex = index;

    document.getElementById('txType').value = tx.tipo;
    document.getElementById('txConcept').value = tx.concepto;
    document.getElementById('txAmount').value = tx.monto;
    document.getElementById('txCategory').value = tx.categoria;

    if (document.getElementById('seccionVentaProducto')) {
        document.getElementById('seccionVentaProducto').style.display = 'none';
    }

    const submitBtn = document.querySelector('#transactionForm .btn-submit');
    if (submitBtn) submitBtn.textContent = "Actualizar Registro";

    document.getElementById('modalTransaction').hidden = false;
};

function poblarSelectorMeses() {
    const selector = document.getElementById('filtroMes');
    if (!selector) return;

    // Extraer años y meses de todas las transacciones
    const mesesDisponibles = new Set();
    
    transacciones.forEach(tx => {
        let fecha;
        // Lógica para detectar la fecha según cómo esté guardada
        if (tx.fechaTimestamp?.toDate) {
            fecha = tx.fechaTimestamp.toDate();
        } else if (tx.fecha && typeof tx.fecha === 'string') {
            // Asume formato "DD/MM/YYYY" (ajusta si es distinto)
            const partes = tx.fecha.split('/');
            fecha = new Date(partes[2], partes[1] - 1, partes[0]);
        } else {
            fecha = new Date();
        }

        if (!isNaN(fecha)) {
            const mesAño = `${fecha.getFullYear()}-${fecha.getMonth() + 1}`;
            mesesDisponibles.add(mesAño);
        }
    });

    // Ordenar de más reciente a más antiguo
    const listaMeses = Array.from(mesesDisponibles).sort((a, b) => {
        return new Date(b) - new Date(a);
    });

    // Construir el HTML
    let htmlOptions = '<option value="all">Todos los meses</option>';
    listaMeses.forEach(m => {
        const [year, month] = m.split('-');
        const nombreMes = new Date(year, month - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        htmlOptions += `<option value="${m}">${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}</option>`;
    });

    selector.innerHTML = htmlOptions;
}

window.aplicarFiltros = function() {
    const valor = document.getElementById('filtroMes').value;
    
    if (valor === 'all') {
        transaccionesFiltradas = transacciones;
    } else {
        transaccionesFiltradas = transacciones.filter(tx => {
            const date = tx.fechaTimestamp?.toDate ? tx.fechaTimestamp.toDate() : new Date();
            const mesTx = `${date.getFullYear()}-${date.getMonth() + 1}`;
            return mesTx === valor;
        });
    }
    
    // Renderizamos la tabla y métricas usando el array FILTRADO
    renderTransacciones(transaccionesFiltradas);
    calcularMetricasFinancieras(transaccionesFiltradas);
};
