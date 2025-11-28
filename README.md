# Outil de suivi d'occupation des salles

## Comprendre les fichiers

### Slot.js

Le fichier `Slot.js` définit la classe `Slot`, qui contient les informations concernant un créneau horaire (par exemple,
la salle, l'heure, le jour, etc.). Chaque créneau représente une période de temps spécifique pour un cours.

Méthodes principales de `Slot` :

- **equalsSlot** : Compare deux créneaux pour vérifier s'ils sont identiques.
- **overlapsSlot** : Vérifie si deux créneaux se chevauchent en termes de temps.
- **compareSlot** : Compare deux créneaux par jour et heure de début pour les trier.

```js
// Exemple d'utilisation de la classe Slot
const Slot = require('./Slot');

let slot1 = new Slot({
    courseCode: 'ME01',
    lessonType: 'CM',
    capacity: 30,
    day: 'L',
    startTime: '10:00',
    endTime: '12:00',
    room: 'A101',
    subgroup: 'F1',
    groupIndex: 1
});

/// Exemple d'utilisation de la méthode Slot 

let slot2 = new Slot({
    courseCode: 'GL02',
    lessonType: 'CM',
    capacity: 30,
    day: 'T',
    startTime: '10:00',
    endTime: '12:00',
    room: 'A101',
    subgroup: 'F1',
    groupIndex: 1
});

slot1.equalsSlot(slot2) // compare deux créneaux
//Sortie attendue : false
```

### SlotSet.js

Le fichier `SlotSet.js` gère une collection d'objets `Slot`. Il permet d'ajouter, de supprimer et de filtrer les
créneaux.

Méthodes principales de SlotSet :

- **add** : Ajoute un créneau à l'ensemble s'il n'est pas déjà présent.
- **contains** : Vérifie si un créneau existe déjà dans l'ensemble.
- **remove**: Supprime un créneau spécifique de l'ensemble.
- **filter** : Filtre les créneaux en fonction d'une condition donnée.
- **sort** : Trie les créneaux par jour et heure de début.

```js
// Exemple d'utilisation de la classe SlotSet
const SlotSet  = require('./SlotSet');

let slotSet = SlotSet.empty();
slotSet.add(slot1);
console.log(slotSet.toArray());  // Affiche tous les créneaux sous forme de tableau
```

### CruParser

J'ai essayé de rendre l'utilisation du parseur aussi simple que possible, donc vous n'avez besoin de connaître qu'une seule fonction.

En gros, vous avez juste besoin de la fonction `parse` :

```js
const CruParser = require('./CruParser');
const parser = new CruParser(true); // true signifie que vous pouvez voir la sortie dans la console
const slotSet = parser.parse(data) // data : le texte provenant d'un fichier dans un dossier "data"
console.log(slotSet.toArray()); // Une façon simple de visualiser le résultat
```