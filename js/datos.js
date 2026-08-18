/* CONTESSA — utilidades compartidas por todas las páginas */
(function (global) {
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var slug = function (s) {
    return String(s || '').toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  function pedirJSON(archivo, clave, respaldo) {
    return fetch(archivo, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) {
        if (clave === null) return (j && typeof j === 'object') ? j : respaldo;
        return (j && j[clave]) ? j[clave] : respaldo;
      })
      .catch(function () { return respaldo; });
  }

  function cargarDatos() {
    return Promise.all([
      pedirJSON('/config.json', null, {}),
      pedirJSON('/colecciones.json', 'colecciones', []),
      pedirJSON('/piezas.json', 'piezas', []),
      pedirJSON('/portada.json', 'fotos', [])
    ]).then(function (res) {
      var cfg = res[0] || {};
      var cols = (res[1] || []).filter(function (c) { return c && c.nombre && c.visible !== false; });
      var piezas = (res[2] || []).filter(function (p) { return p && p.nombre && p.visible !== false; });
      var portada = res[3] || [];
      return { cfg: cfg, cols: cols, piezas: piezas, portada: portada };
    });
  }

  function agrupar(cols, piezas) {
    var nombres = cols.map(function (c) { return c.nombre; });
    var huerfanas = piezas.filter(function (p) { return nombres.indexOf(p.coleccion) === -1; });
    var grupos = cols.map(function (c) {
      return { nombre: c.nombre, descripcion: c.descripcion, items: piezas.filter(function (p) { return p.coleccion === c.nombre; }) };
    });
    if (huerfanas.length) grupos.push({ nombre: 'Otras piezas', descripcion: '', items: huerfanas });
    return grupos.filter(function (g) { return g.items.length > 0; });
  }

  function linksContacto(cfg) {
    var wa = (cfg.whatsapp || '').replace(/[^0-9]/g, '');
    var base = 'https://wa.me/' + wa;
    return {
      wa: base,
      waMsg: function (texto) { return base + '?text=' + encodeURIComponent(texto); },
      ig: 'https://instagram.com/' + (cfg.instagram || '')
    };
  }

  function aplicarContactoGlobal(cfg) {
    var l = linksContacto(cfg);
    document.querySelectorAll('[data-wa]').forEach(function (el) {
      var msg = el.getAttribute('data-wa-msg') || 'Hola CONTESSA!';
      el.href = l.waMsg(msg);
    });
    document.querySelectorAll('[data-ig]').forEach(function (el) { el.href = l.ig; });
    return l;
  }

  function tarjetaPieza(p, waLink) {
    var msg = 'Hola CONTESSA! Me interesa el ' + p.nombre;
    var fotos = (p.fotos && p.fotos.length) ? p.fotos : [p.foto];
    fotos = fotos.filter(function (f) { return !!f; });
    if (!fotos.length) fotos = [p.foto];

    var slides = fotos.map(function (f, i) {
      return '<img class="slide' + (i === 0 ? ' activa' : '') + '" src="' + esc(f)
        + '" alt="' + esc(p.nombre) + '" loading="lazy">';
    }).join('');

    var puntos = fotos.length > 1
      ? '<span class="pieza-dots">' + fotos.map(function (f, i) {
          return '<i' + (i === 0 ? ' class="activo"' : '') + '></i>';
        }).join('') + '</span>'
      : '';

    return ''
      + '<article class="pieza">'
      + '<div class="pieza-img' + (fotos.length > 1 ? ' multi' : '') + '">' + slides + puntos + '</div>'
      + '<h4>' + esc(p.nombre) + '</h4>'
      + '<p class="desc">' + esc(p.descripcion) + '</p>'
      + '<p class="precio">' + esc(p.precio) + '</p>'
      + '<a class="btn-mini" href="' + waLink.waMsg(msg) + '" target="_blank" rel="noopener">Consultar</a>'
      + '</article>';
  }

  /* Carrusel de fotos dentro de cada tarjeta: si un modelo tiene más de una
     foto, se van pasando solas. Se escalonan para que no cambien todas juntas,
     y solo corren las tarjetas que están a la vista. */
  function activarGalerias(raiz) {
    var cajas = (raiz || document).querySelectorAll('.pieza-img.multi');
    if (!cajas.length) return;

    var soporta = 'IntersectionObserver' in window;
    var obs = soporta ? new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) arrancar(e.target); else parar(e.target);
      });
    }, { rootMargin: '80px' }) : null;

    function pasar(caja) {
      var slides = caja.querySelectorAll('img.slide');
      var puntos = caja.querySelectorAll('.pieza-dots i');
      if (slides.length < 2) return;
      var i = +(caja.getAttribute('data-i') || 0);
      slides[i].classList.remove('activa');
      if (puntos[i]) puntos[i].classList.remove('activo');
      i = (i + 1) % slides.length;
      slides[i].classList.add('activa');
      if (puntos[i]) puntos[i].classList.add('activo');
      caja.setAttribute('data-i', i);
    }

    function arrancar(caja) {
      if (caja._t) return;
      var espera = +(caja.getAttribute('data-offset') || 0);
      caja._d = setTimeout(function () {
        pasar(caja);
        caja._t = setInterval(function () { pasar(caja); }, 3400);
      }, espera);
    }
    function parar(caja) {
      clearTimeout(caja._d); clearInterval(caja._t);
      caja._d = null; caja._t = null;
    }

    Array.prototype.forEach.call(cajas, function (caja, n) {
      caja.setAttribute('data-i', 0);
      caja.setAttribute('data-offset', (n % 5) * 680);
      caja.querySelectorAll('.pieza-dots i').forEach(function (pt, k) {
        pt.addEventListener('click', function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          var slides = caja.querySelectorAll('img.slide');
          var puntos = caja.querySelectorAll('.pieza-dots i');
          var actual = +(caja.getAttribute('data-i') || 0);
          slides[actual].classList.remove('activa');
          puntos[actual].classList.remove('activo');
          slides[k].classList.add('activa');
          puntos[k].classList.add('activo');
          caja.setAttribute('data-i', k);
        });
      });
      if (obs) obs.observe(caja); else arrancar(caja);
    });
  }

  var NAV_ITEMS = [
    { id: 'inicio', href: '/index.html', label: 'Inicio' },
    { id: 'coleccion', href: '/coleccion.html', label: 'Colección' },
    { id: 'nosotros', href: '/nosotros.html', label: 'Nosotros' },
    { id: 'contacto', href: '/contacto.html', label: 'Contacto' }
  ];

  function renderNav() {
    var actual = document.body.getAttribute('data-page');
    var items = NAV_ITEMS.map(function (n) {
      return '<li><a class="navlink' + (n.id === actual ? ' activo' : '') + '" href="' + n.href + '">' + n.label + '</a></li>';
    }).join('');
    var html = ''
      + '<div class="wrap">'
      + '<a class="marca" href="/index.html"><span>CONTESSA</span></a>'
      + '<ul id="navlist">' + items
      + '<li><a class="navlink navcta" data-wa data-wa-msg="Hola CONTESSA! Quiero consultar por una pieza" href="#" target="_blank" rel="noopener">WhatsApp</a></li>'
      + '</ul>'
      + '<button class="burger" id="burger" aria-label="Menú"><span></span><span></span><span></span></button>'
      + '</div>';
    var nav = document.getElementById('nav-placeholder');
    if (nav) {
      nav.outerHTML = '<nav class="sitenav">' + html + '</nav>';
      var burger = document.getElementById('burger');
      var list = document.getElementById('navlist');
      if (burger && list) burger.addEventListener('click', function () { list.classList.toggle('abierto'); });
    }
  }

  function renderFooter(cfg) {
    var el = document.getElementById('footer-placeholder');
    if (!el) return;
    var html = ''
      + '<footer>'
      + '<div class="wrap">'
      + '<div class="fmarca"><img src="/img/logo.png" alt="CONTESSA"><span>CONTESSA</span></div>'
      + '<div class="ftag">Joyas que iluminan el alma</div>'
      + '<div class="links">'
      + '<a data-ig href="#" target="_blank" rel="noopener">Instagram</a>'
      + '<a data-wa data-wa-msg="Hola CONTESSA!" href="#" target="_blank" rel="noopener">WhatsApp</a>'
      + '<a href="/coleccion.html">Colección</a>'
      + '<a href="/nosotros.html">Nosotros</a>'
      + '<a href="/contacto.html">Contacto</a>'
      + '</div>'
      + '<div class="legal">contessajoyas.com.ar · Buenos Aires, Argentina</div>'
      + '</div>'
      + '</footer>'
      + '<a class="wa" data-wa data-wa-msg="Hola CONTESSA!" href="#" target="_blank" rel="noopener" aria-label="WhatsApp">'
      + '<svg viewBox="0 0 24 24"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.2 5.07 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35zM12.04 2.5c-5.24 0-9.5 4.26-9.5 9.5 0 1.68.44 3.32 1.28 4.77L2.5 21.5l4.87-1.28a9.46 9.46 0 004.67 1.22h.01c5.24 0 9.5-4.26 9.5-9.5s-4.27-9.44-9.51-9.44z"/></svg>'
      + '</a>';
    el.outerHTML = html;
  }

  global.CONTESSA = {
    esc: esc, slug: slug,
    cargarDatos: cargarDatos, agrupar: agrupar,
    linksContacto: linksContacto, aplicarContactoGlobal: aplicarContactoGlobal,
    tarjetaPieza: tarjetaPieza, activarGalerias: activarGalerias,
    renderNav: renderNav, renderFooter: renderFooter
  };
})(window);

/* Redirige al panel después de aceptar la invitación por mail */
if (window.netlifyIdentity) {
  window.netlifyIdentity.on('init', function (user) {
    if (!user) {
      window.netlifyIdentity.on('login', function () { document.location.href = '/admin/'; });
    }
  });
}
