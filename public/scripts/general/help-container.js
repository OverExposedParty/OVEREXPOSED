const helpContainer = document.querySelector('.help-container');
const helpTitle = document.querySelector('.help-title');
const helpText = document.querySelector('.help-text');
const helpContainerLeft = document.querySelector('.help-arrow.left-arrow');
const helpContainerRight = document.querySelector('.help-arrow.right-arrow');
const helpNumberCounter = document.querySelector('.help-number-counter');
const helpContainerIndexButton = document.querySelector('.help-index-button');

let helpData = [];
let currentHelpIndex = 0;

// ---------------------------------------------------
//  BUILD HELP TEXT (supports images + paragraph)
// ---------------------------------------------------
function buildHelpText(textObj) {
  // Backwards-compatible: simple string
  if (typeof textObj === "string") {
    return `<p class="help-text help-animate">${textObj}</p>`;
  }

  let html = `<p class="help-text help-animate">`;

  // Multiple images
  if (Array.isArray(textObj.images)) {
    textObj.images.forEach(img => {
      html += `
        <img 
          class="tutorial-image"
          src="${img.src}"
          alt="${img.alt || ''}"
        >
      `;
    });
  }

  // Text paragraph
  if (textObj.paragraph) {
    html += `<span class="help-paragraph">${textObj.paragraph}</span>`;
  }

  html += `</p>`;
  return html;
}

// ---------------------------------------------------
//  PRELOAD IMAGES (supports new images[] format)
// ---------------------------------------------------
async function preloadImagesStructured(pages) {
  const urls = new Set();

  pages.forEach(page => {
    // Preload images inside structured images[]
    if (page.text && Array.isArray(page.text.images)) {
      page.text.images.forEach(img => {
        if (img.src) urls.add(img.src);
      });
    }

    // Preload images inside paragraph HTML
    if (page.text && typeof page.text.paragraph === "string") {
      const matches = page.text.paragraph.matchAll(/<img[^>]+src=["']([^"']+)["']/g);
      for (const m of matches) urls.add(m[1]);
    }

    // Preload images inside old text string format
    if (typeof page.text === "string") {
      const matches = page.text.matchAll(/<img[^>]+src=["']([^"']+)["']/g);
      for (const m of matches) urls.add(m[1]);
    }

    // Preload images inside title icons
    if (typeof page.title === "string") {
      const matches = page.title.matchAll(/<img[^>]+src=["']([^"']+)["']/g);
      for (const m of matches) urls.add(m[1]);
    }
  });

  const preloadPromises = [...urls].map(src => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = src;
    });
  });

  await Promise.all(preloadPromises);
}


// ---------------------------------------------------
//  FETCH HELP CONTAINER
// ---------------------------------------------------
async function FetchHelpContainer(helpContainerFile) {
  fetch(`/json-files/help-containers/${helpContainerFile}`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then(async (data) => {

      let mainPages = [];
      let extraPages = [];
      let additionalFiles = [];

      // --- Extract additional container file links ---
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item["additional-help-containers"]) {
            const value = item["additional-help-containers"];
            additionalFiles.push(...(Array.isArray(value) ? value : [value]));
          } else {
            mainPages.push(item);
          }
        });

      } else if (typeof data === "object") {
        if (data["additional-help-containers"]) {
          const value = data["additional-help-containers"];
          additionalFiles.push(...(Array.isArray(value) ? value : [value]));
        }

        if (Array.isArray(data.items)) {
          data.items.forEach(item => {
            if (!item["additional-help-containers"]) {
              mainPages.push(item);
            }
          });
        }
      }

      // --- Load additional containers FIRST ---
      for (const file of additionalFiles) {
        try {
          const res = await fetch(`/json-files/help-containers/${file}`);
          if (!res.ok) throw new Error(`Failed to load ${file}`);

          const extraData = await res.json();

          if (Array.isArray(extraData)) {
            extraData.forEach(item => {
              if (!item["additional-help-containers"]) {
                extraPages.push(item);
              }
            });
          } else if (Array.isArray(extraData.items)) {
            extraData.items.forEach(item => {
              if (!item["additional-help-containers"]) {
                extraPages.push(item);
              }
            });
          }

        } catch (err) {
          console.error(`Failed to fetch extra container (${file}):`, err);
        }
      }

      // --- Combine pages: extra first, main pages after ---
      let allPages = [...extraPages, ...mainPages];

      // --- Convert [IMG: ... ALT: ...] inside strings ---
      const imgRegex = /\[IMG:(.*?)\s+ALT:(.*?)\]/g;

      allPages = allPages.map(item => {

        // Convert inside TITLE
        if (typeof item.title === "string") {
          item.title = item.title.replace(
            imgRegex,
            (match, src, alt) =>
              `<img src="${src.trim()}" alt="${alt.trim()}" class="inline-icon">`
          );
        }

        // Convert inside TEXT (if old format)
        if (typeof item.text === "string") {
          item.text = item.text.replace(
            imgRegex,
            (match, src, alt) =>
              `<img src="${src.trim()}" alt="${alt.trim()}" class="inline-icon">`
          );
        }

        // Convert inside TEXT.paragraph (new format)
        if (item.text && typeof item.text.paragraph === "string") {
          item.text.paragraph = item.text.paragraph.replace(
            imgRegex,
            (match, src, alt) =>
              `<img src="${src.trim()}" alt="${alt.trim()}" class="inline-icon">`
          );
        }

        return item;
      });

      // --- PRELOAD ALL IMAGES (structured + HTML img tags) ---
      await preloadImagesStructured(allPages);

      // Create the help index page dynamically
      const contextContainer = {
        title: "Help Index",
        text: {
          paragraph: `<div class="help-index-grid">
           ${allPages
            .map((item, i) => {
              const name = item.title || `Container ${i + 1}`;

              return `
                <button class="help-index-btn" data-go="${i + 1}">
                  ${name}
                </button>
              `;
            })
            .join("")}
          </div>`
        }
      };

      allPages.unshift(contextContainer);

      helpData = allPages;
      currentHelpIndex = 0;

      const arrows = document.querySelectorAll('.help-arrow');
      if (helpData.length === 1) {
        arrows.forEach(a => a.classList.add('disabled'));
      } else {
        arrows.forEach(a => a.classList.remove('disabled'));
      }

      showHelpContainer(0);

      // Index button navigation
      document.addEventListener("click", (e) => {
        if (e.target.classList.contains("help-index-btn")) {
          const targetIndex = parseInt(e.target.dataset.go, 10);
          showHelpContainer(targetIndex);
        }
      });

      helpContainerIndexButton.addEventListener('click', () => {
        if (currentHelpIndex === 0) return;
        showHelpContainer(0);
      });

    })
    .catch(err => {
      console.error('Failed to load help pages:', err);
      helpTitle.innerHTML = 'Error';
      helpText.innerHTML = 'Could not load help content.';
      helpNumberCounter.textContent = '';
    });
}


// ---------------------------------------------------
//  SHOW PAGE
// ---------------------------------------------------
function showHelpContainer(index) {
  if (!helpData.length) return;

  const targetIndex = (index + helpData.length) % helpData.length;
  const duration = 180; // squish animation

  helpText.style.transform = "scaleX(0.05)";
  helpTitle.style.transform = "scaleX(0.05)";

  setTimeout(() => {
    currentHelpIndex = targetIndex;

    // Title
    helpTitle.innerHTML = helpData[currentHelpIndex].title;

    // Text (with images handled)
    helpText.innerHTML = buildHelpText(helpData[currentHelpIndex].text);

    helpNumberCounter.textContent = `(${currentHelpIndex + 1}/${helpData.length})`;

    helpText.style.transform = "scaleX(1)";
    helpTitle.style.transform = "scaleX(1)";

  }, duration);
}

// ---------------------------------------------------
//  NAVIGATION
// ---------------------------------------------------
helpContainerLeft.addEventListener('click', () => {
  showHelpContainer(currentHelpIndex - 1);
});

helpContainerRight.addEventListener('click', () => {
  showHelpContainer(currentHelpIndex + 1);
});
