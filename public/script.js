
const $ = (id) => document.getElementById(id);

let selectedGender = "male";
let selectedModel = "classic";
let selectedImage = null;
let generatedImage = null;
let skinViewer = null;
let autoRotate = true;

// =================================
// LOAD SKINVIEW3D
// =================================

function loadSkinView3D() {
  return new Promise((resolve, reject) => {
    if (window.skinview3d) {
      resolve(window.skinview3d);
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/skinview3d@3.0.0/bundles/skinview3d.bundle.js";

    script.onload = () => {
      if (window.skinview3d) resolve(window.skinview3d);
      else reject(new Error("Skinview3D tidak berhasil dimuat."));
    };

    script.onerror = () =>
      reject(new Error("Gagal memuat Skinview3D. Periksa internet."));

    document.head.appendChild(script);
  });
}

// =================================
// MESSAGE
// =================================

function showMessage(message, error = false) {
  const element = $("message");
  if (!element) return;

  element.textContent = message;
  element.style.color = error ? "#ff6262" : "#67e8ff";
}

// =================================
// IMAGE UPLOAD
// =================================

$("imageInput").addEventListener("change", (event) => {
  const file = event.target.files[0];

  if (!file) return;

  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    showMessage("Format gambar harus PNG, JPG, atau WEBP.", true);
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    showMessage("Ukuran gambar maksimal 8 MB.", true);
    return;
  }

  selectedImage = file;

  const reader = new FileReader();

  reader.onload = () => {
    const preview = $("sourcePreview");
    preview.src = reader.result;
    preview.hidden = false;
  };

  reader.readAsDataURL(file);

  showMessage("Gambar berhasil dipilih.");
});

// =================================
// GENDER SELECTION
// =================================

function selectGender(gender) {
  selectedGender = gender;

  $("maleBtn").classList.toggle("active", gender === "male");
  $("femaleBtn").classList.toggle("active", gender === "female");

  selectModel(gender === "male" ? "classic" : "slim");
}

$("maleBtn").addEventListener("click", () => {
  selectGender("male");
});

$("femaleBtn").addEventListener("click", () => {
  selectGender("female");
});

// =================================
// MINECRAFT MODEL
// =================================

function selectModel(model) {
  selectedModel = model;

  const selector = $("modelType");
  if (selector) selector.value = model;

  if (skinViewer) {
    skinViewer.playerObject.skinType =
      model === "slim" ? "slim" : "default";
  }
}

$("modelType").addEventListener("change", (event) => {
  const model = event.target.value;

  selectedModel = model;
  selectedGender = model === "slim" ? "female" : "male";

  $("maleBtn").classList.toggle("active", selectedGender === "male");
  $("femaleBtn").classList.toggle("active", selectedGender === "female");

  selectModel(model);
});

// =================================
// 3D VIEWER
// =================================

async function initializeViewer() {
  try {
    const library = await loadSkinView3D();

    const container = $("viewer");
    container.innerHTML = "";

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "360px";

    container.appendChild(canvas);

    skinViewer = new library.SkinViewer({
      canvas,
      width: container.clientWidth || 350,
      height: 360
    });

    skinViewer.controls.enableRotate = true;
    skinViewer.controls.enableZoom = true;
    skinViewer.controls.enablePan = false;

    skinViewer.playerObject.skinType =
      selectedModel === "slim" ? "slim" : "default";

    if (library.IdleAnimation) {
      skinViewer.animation = new library.IdleAnimation();
    }

    skinViewer.autoRotate = autoRotate;

    window.addEventListener("resize", () => {
      if (!skinViewer) return;

      skinViewer.setSize(
        container.clientWidth || 350,
        360
      );
    });

  } catch (error) {
    console.error(error);
    $("viewer").textContent =
      "Preview 3D gagal dimuat. Periksa koneksi internet.";
  }
}

// =================================
// LOAD GENERATED SKIN
// =================================

async function show3DSkin(imageUrl) {
  if (!skinViewer) {
    await initializeViewer();
  }

  if (!skinViewer) return;

  try {
    await skinViewer.loadSkin(imageUrl);

    skinViewer.playerObject.skinType =
      selectedModel === "slim" ? "slim" : "default";

    skinViewer.autoRotate = autoRotate;

  } catch (error) {
    console.error("Skin preview error:", error);
    showMessage("Gagal menampilkan skin 3D.", true);
  }
}

// =================================
// GENERATE CHARACTER
// =================================

async function generateCharacter() {
  if (!selectedImage) {
    showMessage("Pilih gambar anime terlebih dahulu.", true);
    return;
  }

  const button = $("generateBtn");

  button.disabled = true;
  button.textContent = "SEDANG MEMPROSES...";

  showMessage("AI sedang memproses gambar...");

  try {
    const formData = new FormData();
    formData.append("image", selectedImage);

    const response = await fetch("/api/convert", {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Proses AI gagal.");
    }

    if (!result.image) {
      throw new Error(
        "Server belum mengirim hasil gambar. Periksa response API."
      );
    }

    generatedImage = result.image;

    $("conceptPreview").src = generatedImage;
    $("conceptPreview").hidden = false;

    await show3DSkin(generatedImage);

    createSkinPNG(generatedImage);

    $("skinBtn").disabled = false;
    $("downloadBtn").disabled = false;

    showMessage("Proses selesai!");

  } catch (error) {
    console.error(error);
    showMessage(error.message, true);

  } finally {
    button.disabled = false;
    button.textContent = "GENERATE CHARACTER";
  }
}

$("generateBtn").addEventListener("click", generateCharacter);

// =================================
// CREATE 64x64 PNG
// =================================

function createSkinPNG(imageUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = $("skinCanvas");
      const context = canvas.getContext("2d");

      canvas.width = 64;
      canvas.height = 64;

      context.clearRect(0, 0, 64, 64);
      context.imageSmoothingEnabled = false;

      context.drawImage(image, 0, 0, 64, 64);

      resolve(canvas);
    };

    image.onerror = () => reject(
      new Error("Gagal membuat gambar skin.")
    );

    image.src = imageUrl;
  });
}

// =================================
// DOWNLOAD SKIN
// =================================

$("downloadBtn").addEventListener("click", () => {
  const canvas = $("skinCanvas");

  if (!generatedImage) {
    showMessage("Generate gambar terlebih dahulu.", true);
    return;
  }

  const link = document.createElement("a");

  link.download =
    `MESKY-AI-${selectedGender}-${selectedModel}-64x64.png`;

  link.href = canvas.toDataURL("image/png");
  link.click();

  showMessage("PNG berhasil disiapkan.");
});

// =================================
// AUTO ROTATE
// =================================

$("rotateBtn").addEventListener("click", () => {
  autoRotate = !autoRotate;

  if (skinViewer) {
    skinViewer.autoRotate = autoRotate;
  }

  $("rotateBtn").textContent = autoRotate
    ? "AUTO ROTATE ON"
    : "AUTO ROTATE OFF";
});

// =================================
// DEMO MODE
// =================================

$("demoBtn").addEventListener("click", async () => {
  showMessage("Menyiapkan demo...");

  const demoImage = new Image();

  demoImage.crossOrigin = "anonymous";

  demoImage.onload = async () => {
    generatedImage = demoImage.src;

    $("conceptPreview").src = generatedImage;
    $("conceptPreview").hidden = false;

    try {
      await show3DSkin(generatedImage);
      await createSkinPNG(generatedImage);

      $("skinBtn").disabled = false;
      $("downloadBtn").disabled = false;

      showMessage("Demo berhasil dimuat.");
    } catch (error) {
      showMessage(error.message, true);
    }
  };

  demoImage.onerror = () => {
    showMessage("Gambar demo gagal dimuat.", true);
  };

  demoImage.src =
    "https://placehold.co/256x256/101a35/67e8ff.png?text=MESKY+AI";
});

// =================================
// BUTTON SKIN
// =================================

$("skinBtn").addEventListener("click", () => {
  $("skinCanvas").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
});

// =================================
// START
// =================================

initializeViewer();
      
