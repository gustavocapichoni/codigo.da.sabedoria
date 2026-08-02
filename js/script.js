// Importando Firebase e Firebase Auth (Google Provider)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCd1i6V0OJvdKEMUAkam25h25rt_pGhm6g",
  authDomain: "sistema-op-marketing.firebaseapp.com",
  projectId: "sistema-op-marketing",
  storageBucket: "sistema-op-marketing.firebasestorage.app",
  messagingSenderId: "414079073696",
  appId: "1:414079073696:web:afe2702087524def5038c5",
  measurementId: "G-CP91YD8C7Z"
};

// Inicializando Firebase, Firestore e Auth
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Variável para guardar o link do PDF puxado do banco
let pdfUrlAtivo = "#";

// ─── Busca a campanha ativa do Firestore ───
async function carregarCampanhaAtiva() {
  try {
    const campanhasRef = collection(db, "campanhas");
    const q = query(campanhasRef, orderBy("criada_em", "desc"), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const dadosCampanha = querySnapshot.docs[0].data();
      pdfUrlAtivo = dadosCampanha.pdf_url || "#";
      
      const dynamicNameEl = document.getElementById("dynamic-pdf-name");
      if (dynamicNameEl && dadosCampanha.titulo) {
        dynamicNameEl.textContent = dadosCampanha.titulo;
      }
    } else {
      console.log("Nenhuma campanha ativa encontrada.");
    }
  } catch (e) {
    console.error("Erro ao carregar campanha:", e);
  }
}

// Roda a busca logo que a página abre
carregarCampanhaAtiva();

// ─── Login com o Google (Firebase Auth) ───
const googleBtn = document.getElementById("google-login-btn");
if (googleBtn) {
  googleBtn.addEventListener("click", async function() {
    googleBtn.classList.add("loading");
    googleBtn.disabled = true;

    try {
      // Dispara a janela pop-up de login do Google
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const nome = user.displayName || "Usuário";
      const email = (user.email || "").toLowerCase();
      const photoURL = user.photoURL || "";
      const uid = user.uid;

      console.log("Usuário autenticado via Google:", nome, email);

      // Verifica se o lead já existe no Firestore pelo e-mail
      const leadsRef = collection(db, "leads");
      const qEmail = query(leadsRef, where("email", "==", email));
      const snapEmail = await getDocs(qEmail);

      if (snapEmail.empty) {
        // Salva novo lead vindo do Google
        await addDoc(leadsRef, {
          uid: uid,
          nome: nome,
          email: email,
          foto_perfil: photoURL,
          origem: "landing_page_google",
          data_captura: serverTimestamp(),
          enviado_email: true
        });
        console.log("Novo lead salvo no banco com sucesso!");
      } else {
        console.log("Lead já cadastrado no banco. Liberando acesso...");
      }

      // Envia o e-mail via Google Apps Script (com fallbacks)
      const gasUrls = [
        "https://script.google.com/macros/s/AKfycbwIYRlqRu_7wMdfB1YNhBcx6kzIBnvRg8zhE9QgrLkpS9CHsY5A-jOuqJ30cATDGNvkLA/exec",
        "https://script.google.com/macros/s/AKfycbzOGmpcuiiQHBlwHkj4wYokY_QTgaEIt5DrbjXZORAWSs42leAt3IyEtjCT0WHKuwhu/exec",
        "https://script.google.com/macros/s/AKfycbyulwxIa_84L6_0QKGWO3-JJofa_JWVAiSlk1TVle56ZzgWgSSWw49pqGh_X-TZp4CY/exec"
      ];

      const sleep = ms => new Promise(r => setTimeout(r, ms));
      let enviadoComSucesso = false;

      for (const url of gasUrls) {
        if (enviadoComSucesso) break;
        for (let tentativa = 1; tentativa <= 3; tentativa++) {
          try {
            await fetch(url, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({ 
                email: email, 
                name: nome, 
                link: pdfUrlAtivo
              })
            });
            enviadoComSucesso = true;
            break;
          } catch (e) {
            console.warn(`Falha na tentativa ${tentativa} da URL atual...`);
            if (tentativa < 3) await sleep(1500);
          }
        }
      }

      // Oculta área inicial e exibe a tela de sucesso para download
      document.getElementById("form-card").style.display = "none";
      document.getElementById("features").style.display = "none";
      document.getElementById("hero-sub").style.display = "none";

      const section = document.getElementById("download-section");
      section.classList.add("visible");

    } catch (error) {
      console.error("Erro no login do Google:", error);
      // Trata cancelamento pelo usuário sem exibir alerta assustador
      if (error.code !== "auth/popup-closed-by-user" && error.code !== "auth/cancelled-popup-request") {
        alert("Ocorreu um erro ao conectar com a conta Google. Tente novamente.");
      }
    } finally {
      googleBtn.classList.remove("loading");
      googleBtn.disabled = false;
    }
  });
}
