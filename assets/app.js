const root = document.documentElement;
const body = document.body;
const page = body.dataset.page || "home";
const servicePageKey = body.dataset.service || "";
const siteData = window.siteData;
const savedLang = localStorage.getItem("fosagri-lang");
let currentLang = savedLang || "fr";
let heroSliderStarted = false;

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

function setLanguage(lang) {
  currentLang = lang === "ar" ? "ar" : "fr";
  localStorage.setItem("fosagri-lang", currentLang);
  root.lang = currentLang;
  root.dir = currentLang === "ar" ? "rtl" : "ltr";
  body.dataset.lang = currentLang;

  qsa("[data-i18n]").forEach((node) => {
    const parts = node.dataset.i18n.split(".");
    let value = siteData.translations[currentLang];
    parts.forEach((part) => {
      value = value?.[part];
    });
    if (typeof value === "string") {
      node.textContent = value;
    }
  });

  qsa("[data-i18n-html]").forEach((node) => {
    const parts = node.dataset.i18nHtml.split(".");
    let value = siteData.translations[currentLang];
    parts.forEach((part) => {
      value = value?.[part];
    });
    if (typeof value === "string") {
      node.innerHTML = value;
    }
  });

  qsa(".lang-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.lang === currentLang);
  });

  renderPage();
}

function renderServices() {
  const container = qs("#services-grid");
  if (!container) return;
  container.innerHTML = siteData.services
    .map((service) => {
      const content = service[currentLang];
      return `
        <article class="service-card">
          <div class="service-icon" aria-hidden="true">
            <i class="fa-solid ${service.icon}"></i>
          </div>
          <h3>${content.title}</h3>
          <p>${content.description}</p>
          <a href="${service.href}" class="service-link">${siteData.translations[currentLang].services.more}</a>
        </article>
      `;
    })
    .join("");
}

function renderNews() {
  const container = qs("#news-grid");
  if (!container) return;
  container.innerHTML = siteData.news
    .map((item, index) => {
      const content = item[currentLang];
      return `
        <article class="news-card" data-news-index="${index}">
          <div class="news-media news-media-${index + 1}" aria-hidden="true"></div>
          <div class="news-body">
            <span class="news-date">${item.date}</span>
            <h3>${content.title}</h3>
            <p>${content.excerpt}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderEvents() {
  const container = qs("#events-timeline");
  if (!container) return;
  container.innerHTML = siteData.events
    .map((item) => {
      const content = item[currentLang];
      return `
        <article class="timeline-item">
          <div class="timeline-date">${item.date}</div>
          <div class="timeline-card">
            <h3>${content.title}</h3>
            <p>${content.excerpt}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderStats() {
  const container = qs("#stats-grid");
  if (!container) return;

  container.innerHTML = siteData.stats
    .map(
      (item) => `
        <article class="stat-card">
          <div class="stat-icon" aria-hidden="true"><i class="fa-solid ${item.icon}"></i></div>
          <strong>${item.value}</strong>
          <span>${item[currentLang]}</span>
        </article>
      `
    )
    .join("");

  const quote = qs("#testimonial-quote");
  const author = qs("#testimonial-author");
  if (quote && author) {
    quote.textContent = siteData.testimonials[currentLang].quote;
    author.textContent = siteData.testimonials[currentLang].author;
  }
}

function renderRegions() {
  const card = qs("#region-card");
  const infoTitle = qs("#region-title");
  const infoText = qs("#region-text");
  const infoDot = qs("#region-dot");
  const mapMount = qs("#morocco-map-object");
  const mapPoints = qs("#map-points");
  if (!card || !mapMount) return;

  let activeRegionKey = mapMount.dataset.activeRegion || "tanger-tetouan-al-hoceima";
  let mapWidth = 680;
  let mapHeight = 680;

  const getRegion = (key) => siteData.regions.find((item) => item.key === key) || siteData.regions[0];

  const getMapDimensions = (svgRoot) => {
    const viewBox = svgRoot?.viewBox?.baseVal;
    if (viewBox && viewBox.width && viewBox.height) {
      return { width: viewBox.width, height: viewBox.height };
    }
    return { width: 680, height: 680 };
  };

  const setActiveRegion = (key) => {
    activeRegionKey = key;
    mapMount.dataset.activeRegion = key;
    updateRegionContent(key);
    paintMap();
  };

  const assignTargets = (entries, getX, getY) => {
    const remainingEntries = entries.map((entry) => ({ ...entry }));
    const remainingRegions = siteData.regions.map((region) => ({ ...region }));
    const matches = [];

    while (remainingEntries.length && remainingRegions.length) {
      let best = null;

      remainingEntries.forEach((entry, entryIndex) => {
        remainingRegions.forEach((region, regionIndex) => {
          const dx = getX(entry) - region.target.x;
          const dy = getY(entry) - region.target.y;
          const distance = Math.hypot(dx, dy);
          if (!best || distance < best.distance) {
            best = { distance, entryIndex, regionIndex };
          }
        });
      });

      const [pickedEntry] = remainingEntries.splice(best.entryIndex, 1);
      const [pickedRegion] = remainingRegions.splice(best.regionIndex, 1);
      matches.push({ key: pickedRegion.key, entry: pickedEntry });
    }

    return matches;
  };

  const updateRegionContent = (key) => {
    const region = getRegion(key);
    const content = region[currentLang];
    card.innerHTML = `
      <h3>${content.name}</h3>
      <p class="region-subtitle">${content.delegate}</p>
      <p>${content.details}</p>
    `;
    if (infoTitle) infoTitle.textContent = content.name;
    if (infoText) infoText.textContent = content.details;
    if (infoDot) {
      infoDot.style.backgroundColor = "#c8a44d";
      infoDot.style.opacity = "1";
    }
  };

  const paintMap = (hoverKey = null) => {
    const pathMap = mapMount.__pathMap;
    if (!pathMap) return;

    const svgRoot = mapMount.querySelector("svg");
    if (!svgRoot) return;

    let overlayLayer = svgRoot.querySelector("#map-overlays");
    if (!overlayLayer) {
      overlayLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlayLayer.id = "map-overlays";
      svgRoot.appendChild(overlayLayer);
    }
    overlayLayer.innerHTML = "";

    const goldColor = "#c8a44d";
    const defaultColor = "#266a63";

    pathMap.forEach((path, key) => {
      const region = getRegion(key);
      const isHover = hoverKey === key;
      const isActive = activeRegionKey === key;
      const isStateful = isHover || isActive;

      path.style.fill = isStateful ? goldColor : defaultColor;
      path.style.stroke = "#eef3ec";
      path.style.strokeWidth = "1.4";
      path.style.cursor = "pointer";
      path.style.transition = "fill 0.18s ease, opacity 0.18s ease";
      path.style.opacity = isStateful ? "1" : "0.98";

      if (isStateful) {
        const target = mapMount.__pathCenters?.get(key) || region.target;
        const content = region[currentLang];

        // Draw dot
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", target.x);
        circle.setAttribute("cy", target.y);
        circle.setAttribute("r", "5.5");
        circle.setAttribute("fill", "#1f6a43");
        circle.setAttribute("stroke", "#fff");
        circle.setAttribute("stroke-width", "2");
        overlayLayer.appendChild(circle);

        // White halo behind text
        const textBg = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textBg.setAttribute("x", target.x);
        textBg.setAttribute("y", target.y - 12);
        textBg.setAttribute("text-anchor", "middle");
        textBg.setAttribute("fill", "none");
        textBg.setAttribute("stroke", "#ffffff");
        textBg.setAttribute("stroke-width", "3");
        textBg.setAttribute("stroke-linejoin", "round");
        textBg.setAttribute("font-size", "18");
        textBg.setAttribute("font-weight", "800");
        textBg.setAttribute("font-family", "Inter, Outfit, sans-serif");
        textBg.style.pointerEvents = "none";
        textBg.textContent = content.name;
        overlayLayer.appendChild(textBg);

        // Main label text
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", target.x);
        text.setAttribute("y", target.y - 12);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", "#1f6a43");
        text.setAttribute("font-size", "18");
        text.setAttribute("font-weight", "800");
        text.setAttribute("font-family", "Inter, Outfit, sans-serif");
        text.style.pointerEvents = "none";
        text.textContent = content.name;
        overlayLayer.appendChild(text);
      }
    });
  };

  const assignRegionsToPaths = (paths) =>
    assignTargets(
      paths.map((path) => {
        const box = path.getBBox();
        return {
          path,
          cx: box.x + box.width / 2,
          cy: box.y + box.height / 2
        };
      }),
      (entry) => entry.cx,
      (entry) => entry.cy
    ).map(({ key, entry }) => ({ key, path: entry.path }));

  const bindInteractiveMap = () => {
    const svgRoot = mapMount.querySelector("svg");
    if (!svgRoot) return;
    const dimensions = getMapDimensions(svgRoot);
    mapWidth = dimensions.width;
    mapHeight = dimensions.height;

    const paths = [
      ...svgRoot.querySelectorAll(".region-shape"),
      ...svgRoot.querySelectorAll("#mapLayer path"),
      ...svgRoot.querySelectorAll("path.st0")
    ].filter((path, index, list) => list.indexOf(path) === index);
    if (paths.length < siteData.regions.length) return;
    svgRoot.querySelectorAll("circle").forEach((circle) => {
      circle.style.display = "none";
    });

    if (!mapMount.__pathMap) {
      mapMount.__pathMap = new Map();
      mapMount.__pathCenters = new Map();
      assignRegionsToPaths(paths).forEach(({ key, path }) => {
        mapMount.__pathMap.set(key, path);
        const box = path.getBBox();
        mapMount.__pathCenters.set(key, {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2
        });
        path.dataset.region = key;
        path.addEventListener("mouseenter", () => {
          updateRegionContent(key);
          paintMap(key);
        });
        path.addEventListener("mouseleave", () => {
          updateRegionContent(activeRegionKey);
          paintMap();
        });
        path.addEventListener("click", () => setActiveRegion(key));
      });
    }

    if (mapPoints) mapPoints.innerHTML = "";
    updateRegionContent(activeRegionKey);
    paintMap();
  };

  if (!siteData.regions.some((region) => region.key === activeRegionKey)) {
    activeRegionKey = siteData.regions[0].key;
  }

  updateRegionContent(activeRegionKey);
  if (mapPoints) mapPoints.innerHTML = "";

  if (mapMount.querySelector("svg")) {
    mapMount.__svgLoaded = true;
    bindInteractiveMap();
  } else if (!mapMount.__svgLoaded) {
    fetch("assets/morocco-map.svg")
      .then((response) => response.text())
      .then((svgMarkup) => {
        mapMount.innerHTML = svgMarkup;
        const svgRoot = mapMount.querySelector("svg");
        if (svgRoot) {
          svgRoot.removeAttribute("width");
          svgRoot.removeAttribute("height");
          svgRoot.classList.add("morocco-map-svg");
        }
        bindInteractiveMap();
      })
      .catch(() => {
        mapMount.textContent = "Carte indisponible";
      });
    mapMount.__svgLoaded = true;
  } else {
    bindInteractiveMap();
  }
}

function renderPartners() {
  const container = qs("#partners-grid");
  if (!container) return;
  container.innerHTML = siteData.partners
    .map(
      (partner) => `
        <article class="partner-card">
          <img src="${partner.logo}" alt="${partner.name}" loading="lazy" />
        </article>
      `
    )
    .join("");
}

function renderServicePage() {
  if (page !== "service") return;
  const service = siteData.services.find((item) => item.key === servicePageKey);
  if (!service) return;

  const content = service[currentLang];
  const title = qs("#service-title");
  const description = qs("#service-description");
  const detail = qs("#service-detail");
  const icon = qs("#service-icon");

  if (title) title.textContent = content.title;
  if (description) description.textContent = content.description;
  if (detail) detail.textContent = content.detail;
  if (icon) icon.className = `fa-solid ${service.icon}`;
}

function renderPage() {
  // Shared render cycle keeps home and service pages on the same data source.
  renderServices();
  renderNews();
  renderEvents();
  renderStats();
  renderRegions();
  renderPartners();
  renderServicePage();
  initRevealAnimations();
  initNewsSlider();
}

function initMenu() {
  const toggle = qs(".menu-toggle");
  const nav = qs(".site-nav");
  if (!toggle || !nav) return;

  const closeMenu = () => {
    toggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
  };

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    nav.classList.toggle("is-open", !expanded);
  });

  // Close menu when any nav link is clicked
  qsa(".site-nav a", nav).forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // Close menu when clicking outside (empty space)
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("is-open") &&
      !nav.contains(e.target) &&
      !toggle.contains(e.target)) {
      closeMenu();
    }
  });
}

function initLangButtons() {
  qsa(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
  });
}

function initForm() {
  const form = qs(".contact-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    alert(siteData.translations[currentLang].formNotice);
    form.reset();
  });
}

function initHeroSlider() {
  if (heroSliderStarted) return;
  const slides = qsa(".hero-slide");
  const dotsHost = qs("#hero-dots");
  if (!slides.length || !dotsHost) return;

  slides.forEach((slide) => {
    const image = slide.dataset.image;
    slide.style.backgroundImage = `url("${image}")`;
  });

  let activeIndex = 0;
  dotsHost.innerHTML = slides
    .map(
      (_, index) => `
        <button
          class="hero-dot ${index === 0 ? "is-active" : ""}"
          type="button"
          data-slide-index="${index}"
          aria-label="Slide ${index + 1}"
        ></button>
      `
    )
    .join("");

  const dots = qsa(".hero-dot");
  const setActiveSlide = (index) => {
    activeIndex = index;
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === index);
    });
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
    });
  };

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      setActiveSlide(Number(dot.dataset.slideIndex));
    });
  });

  setInterval(() => {
    const nextIndex = (activeIndex + 1) % slides.length;
    setActiveSlide(nextIndex);
  }, 5000);

  heroSliderStarted = true;
}

function initRevealAnimations() {
  const targets = qsa(
    ".intro-grid > *, .section-head, .service-card, .news-card, .timeline-item, .stat-card, .testimonial-card, .region-card, .member-card, .partner-card, .contact-item"
  );
  if (!targets.length) return;

  targets.forEach((item) => item.classList.add("reveal-on-scroll"));

  if (!("IntersectionObserver" in window)) {
    targets.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  targets.forEach((item) => {
    if (!item.classList.contains("is-visible")) {
      observer.observe(item);
    }
  });
}

function initNewsSlider() {
  const track = qs("#news-grid");
  const prev = qs("#news-prev");
  const next = qs("#news-next");
  const dotsHost = qs("#news-dots");
  if (!track || !prev || !next || !dotsHost) return;

  const cards = qsa(".news-card");
  if (!cards.length) return;

  const perView = () => {
    if (window.innerWidth <= 720) return 1;
    if (window.innerWidth <= 980) return 2;
    return 3;
  };

  let currentIndex = 0;
  const maxIndex = () => Math.max(0, cards.length - perView());

  dotsHost.innerHTML = Array.from({ length: maxIndex() + 1 }, (_, index) => {
    return `<button class="news-dot ${index === 0 ? "is-active" : ""}" type="button" data-news-dot="${index}" aria-label="Actualites ${index + 1}"></button>`;
  }).join("");

  const update = () => {
    const card = cards[0];
    if (!card) return;
    const gap = 24;
    const width = card.getBoundingClientRect().width + gap;
    const isRtl = document.documentElement.dir === "rtl";
    const x = isRtl ? currentIndex * width : -currentIndex * width;
    track.style.transform = `translateX(${x}px)`;
    qsa(".news-dot").forEach((dot, index) => {
      dot.classList.toggle("is-active", index === currentIndex);
    });
  };

  const goTo = (index) => {
    const last = maxIndex();
    if (index > last) currentIndex = 0;
    else if (index < 0) currentIndex = last;
    else currentIndex = index;
    update();
  };

  const startAuto = () => {
    clearInterval(window.__newsAutoTimer);
    window.__newsAutoTimer = setInterval(() => {
      goTo(currentIndex + 1);
    }, 4500);
  };

  prev.onclick = () => {
    goTo(currentIndex - 1);
    startAuto();
  };
  next.onclick = () => {
    goTo(currentIndex + 1);
    startAuto();
  };

  qsa(".news-dot").forEach((dot) => {
    dot.onclick = () => {
      goTo(Number(dot.dataset.newsDot));
      startAuto();
    };
  });

  if (window.__newsResizeHandler) {
    window.removeEventListener("resize", window.__newsResizeHandler);
  }

  window.__newsResizeHandler = () => {
    currentIndex = 0;
    dotsHost.innerHTML = Array.from({ length: maxIndex() + 1 }, (_, index) => {
      return `<button class="news-dot ${index === 0 ? "is-active" : ""}" type="button" data-news-dot="${index}" aria-label="Actualites ${index + 1}"></button>`;
    }).join("");
    qsa(".news-dot").forEach((dot) => {
      dot.onclick = () => {
        goTo(Number(dot.dataset.newsDot));
        startAuto();
      };
    });
    update();
  };

  window.addEventListener("resize", window.__newsResizeHandler);

  update();
  startAuto();
}

initMenu();
initLangButtons();
initForm();
initHeroSlider();
setLanguage(currentLang);

// Hide header on scroll down, show on scroll up
(function initScrollHeader() {
  const header = qs(".site-header");
  if (!header) return;
  let lastScrollTop = 0;

  window.addEventListener("scroll", function () {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > lastScrollTop && scrollTop > 80) {
      // Scrolling down — hide
      header.classList.add("is-hidden");
    } else {
      // Scrolling up — show immediately
      header.classList.remove("is-hidden");
    }

    lastScrollTop = Math.max(0, scrollTop);
  }, { passive: true });
})();

// Back to top button
(function initBackToTop() {
  const btn = qs("#back-to-top");
  if (!btn) return;
  window.addEventListener("scroll", () => {
    btn.classList.toggle("is-visible", window.scrollY > 400);
  }, { passive: true });
  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
