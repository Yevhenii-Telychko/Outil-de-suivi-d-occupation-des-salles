# 🏫 Outil de Suivi d’Occupation des Salles

**Projet GL02 – UTT**
**Auteur : TELYCHKO Yevhenii, KABINET Sylla, LOUARN Dina, CRAVE Sixtine**

---

## 📌 Présentation générale

Cet outil en ligne de commande permet de **consulter, analyser et exporter** les informations issues des fichiers d’emploi du temps **CRU** (format utilisé à l’UTT).
Il permet notamment :

* de rechercher les salles associées à un cours,
* de consulter la capacité des salles,
* de vérifier la disponibilité hebdomadaire d’une salle,
* de trouver les salles libres sur un créneau,
* de détecter des conflits de planification,
* d’exporter un emploi du temps au format **iCalendar (.ics)**,
* d’obtenir des statistiques d’occupation des salles.

L’application est développée en **Node.js**, en respectant une architecture modulaire, robuste et maintenable.

---

## 📁 Structure du projet

```
.
├── CruParser.js             # Parseur du format CRU
├── Slot.js                  # Type Créneau (Cours)
├── SlotSet.js               # Ensemble de créneaux
├── ScheduleService.js       # Logique métier (F1–F8)
├── index.js                 # Interface CLI (Caporal)
├── data/                    # Répertoires contenant les fichiers edt.cru
└── spec/                    # Tests Jasmine
```

---

## ⚙️ Installation

### 1. Installer les dépendances

```bash
npm install
```

### 2. Ajouter les fichiers CRU

Créer un répertoire :

```
/data/NOM_PARCOURS/edt.cru
```

Exemple :

```
data/TC/edt.cru
data/SRT/edt.cru
```

Chaque sous-dossier contenant un fichier `edt.cru` sera automatiquement chargé.

---

## ▶️ Exécution de l’outil

Lancer l’outil avec :

```bash
node index.js --help
```

Toutes les commandes disponibles seront affichées.

---

## 🧭 Commandes disponibles (F1 à F8)

### **F1 – Recherche de salles par cours**

```bash
node index.js search-rooms ME01
```

### **F2 – Capacité d’une salle**

```bash
node index.js room-capacity S101
```

### **F3 – Créneaux libres d’une salle**

```bash
node index.js free-slots S101
```

### **F4 – Salles libres pour un créneau**

```bash
node index.js available-rooms 14:00 16:00 ME
```

### **F5 – Export iCalendar (.ics)**

```bash
node index.js generate-icalendar --courses ME01,ME03 --start 2025-01-06 --end 2025-02-01 --output mon_agenda.ics
```

### **F6 – Vérification des conflits**

```bash
node index.js check-conflicts
```

### **F7 – Statistiques d’occupation des salles**

```bash
node index.js room-usage-stats
```

### **F8 – Classement des salles par capacité**

```bash
node index.js rank-rooms
```

---

## 🧠 Architecture & Conception

### **1. Modèle : `Slot` (Type Créneau)**

Implémente la sémantique décrite dans la spécification :

* `egal(C1, C2)`
* `chevauche(C1, C2)`
* `ordre(C1, C2)`

### **2. Ensemble : `SlotSet`**

Respecte les axiomes :

* unicité des créneaux,
* opérations d’ensemble : `ajouter`, `retirer`, `filtrer`, `contient`.

### **3. Parseur : `CruParser`**

Fonctionnalités :

* lecture du format CRU,
* conversion en instances `Slot`,
* génération iCalendar conforme à la RFC 5545.

### **4. Service métier : `ScheduleService`**

Implémente toutes les exigences fonctionnelles F1–F8 :

* recherche de salles,
* disponibilité,
* conflits,
* statistiques,
* export iCal, etc.

### **5. Interface CLI : `index.js`**

Développée avec **Caporal.js**, elle gère :

* parsing des arguments,
* validation de saisie,
* retours utilisateur clairs.

---

## 🧪 Tests automatisés (Jasmine)

Les tests se trouvent dans :

```
/spec/parser_syntactic_spec.js   # Tests syntaxiques du parser
/spec/parser_semantic_spec.js    # Tests sémantiques (chevauchement, égalité...)
```

Pour lancer les tests :

```bash
npm test
```

Tous les tests doivent passer :

```
12 specs, 0 failures
```

---

## ✔️ Conformité aux exigences (Extraits du cahier des charges)

| Exigence | Statut | Implémentation                      |
| -------- | ------ | ----------------------------------- |
| F1       | ✔️     | ScheduleService.searchRoomsByCourse |
| F2       | ✔️     | ScheduleService.getRoomCapacity     |
| F3       | ✔️     | ScheduleService.getFreeSlotsForRoom |
| F4       | ✔️     | ScheduleService.getAvailableRooms   |
| F5       | ✔️     | CruParser.toICalendar               |
| F6       | ✔️     | ScheduleService.checkConflicts      |
| F7       | ✔️     | ScheduleService.getRoomUsageStats   |
| F8       | ✔️     | ScheduleService.rankRoomsByCapacity |
| N1–N6    | ✔️     | CLI + modularité + robustesse       |

---

## 📚 Technologies utilisées

* **Node.js**
* **JavaScript (CommonJS)**
* **Caporal.js** (CLI)
* **Jasmine** (tests)
* **RFC 5545** pour l’export iCalendar

---

## 👤 Auteur

- **TELYCHKO Yevhenii**
- **KABINET Sylla**
- **LOUARN Dina**
- **CRAVE Sixtine**

---

## 📄 Licence

Projet universitaire — libre réutilisation dans un cadre pédagogique.


