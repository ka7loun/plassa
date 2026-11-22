// Demo data for Sousse. All people, businesses, phone numbers and bookings are
// fictional. The first spots were placed by hand on the OpenStreetMap map; the
// rest are generated deterministically around each neighbourhood (see the end
// of this file) so the city looks lived-in.
import type { PaymentMethod } from "../src/lib/payments";

/** Password of the three demo accounts (also usable on the login form). */
export const DEMO_PASSWORD = "plassa2026";
/** Bump when the demo data changes: deploys reseed when it differs. */
export const SEED_VERSION = "2";

export const DEMO_USERS = {
  driver: { id: "00000000-0000-4000-8000-000000000001", name: "Yassine (démo)", phone: "+21600000101" },
  host: { id: "00000000-0000-4000-8000-000000000002", name: "Salma Ben Ali (démo)", phone: "+21600000102" },
  admin: { id: "00000000-0000-4000-8000-000000000003", name: "Opérateur ville (démo)", phone: "+21600000100" },
} as const;

export const CITIES = [
  { id: "sousse", fr: "Sousse", ar: "سوسة", en: "Sousse", lat: 35.8300, lng: 10.6300, zoom: 14 },
];

export const ZONES = [
  { id: "sousse-babbhar", city: "sousse", fr: "Bab Bhar / Centre", ar: "باب البحر / الوسط", en: "Bab Bhar / Centre", lat: 35.8280, lng: 10.6385 },
  { id: "sousse-medina", city: "sousse", fr: "Médina (abords)", ar: "المدينة العتيقة", en: "Medina (edges)", lat: 35.8250, lng: 10.6335 },
  { id: "sousse-boujaafar", city: "sousse", fr: "Boujaafar / Corniche", ar: "بوجعفر / الكورنيش", en: "Boujaafar / Corniche", lat: 35.8360, lng: 10.6300 },
  { id: "sousse-khezama", city: "sousse", fr: "Khezama", ar: "خزامة", en: "Khezama", lat: 35.8530, lng: 10.6080 },
  { id: "sousse-sahloul", city: "sousse", fr: "Sahloul", ar: "سهلول", en: "Sahloul", lat: 35.8370, lng: 10.5930 },
  { id: "sousse-kantaoui", city: "sousse", fr: "Port El Kantaoui", ar: "القنطاوي", en: "Port El Kantaoui", lat: 35.8905, lng: 10.5935 },
];

const HOST_NAMES = [
  "Mohamed Trabelsi", "Amira Jaziri", "Hédi Gharbi", "Nour Mejri", "Karim Sfar", "Leila Haddad", "Sami Bouzid",
  "Fatma Ben Salah", "Anis Jlassi", "Rim Mansour", "Bilel Karoui", "Sonia Bouaziz", "Hamza Chaabane", "Olfa Hamdi",
  "Mehdi Ayari", "Ines Feki", "Slim Mabrouk", "Wafa Zouari", "Nizar Khelifi", "Dorra Sassi",
];
const pad = (n: number) => String(n).padStart(12, "0");

export const HOSTS: { id: string; name: string; phone: string }[] = [
  DEMO_USERS.host,
  ...HOST_NAMES.map((name, i) => ({ id: `00000000-0000-4000-8000-${pad(10 + i)}`, name, phone: `+21600000${200 + i}` })),
];

const DRIVER_NAMES = [
  "Ines K.", "Walid M.", "Rania S.", "Tarek B.", "Emma L.", "Youssef A.", "Mariem T.", "Aymen H.", "Salma R.", "Omar D.",
  "Nesrine B.", "Firas G.", "Lina M.", "Achref Z.", "Chiraz N.",
];
export const OTHER_DRIVERS = DRIVER_NAMES.map((name, i) => ({ id: `00000000-0000-4000-8000-${pad(60 + i)}`, name }));

export type SpotSeed = {
  host: number; // index in HOSTS, or -1 for the demo driver (who also rents out a spot)
  zone: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  type: "garage" | "courtyard" | "driveway" | "lot" | "basement";
  covered?: boolean;
  price: number; // millimes per hour
  peak?: [number, number, number, number[]?]; // multiplier, startHour, endHour, months
  days?: number[];
  open?: [number, number]; // minutes
  gardien?: [string, string];
  desc: string;
  methods?: PaymentMethod[];
};

const ALL = [0, 1, 2, 3, 4, 5, 6];
const MON_SAT = [1, 2, 3, 4, 5, 6];
const SUMMER = [6, 7, 8, 9];

export const SPOTS: SpotSeed[] = [
  // Bab Bhar / Centre — the hardest place to park
  { host: 0, zone: "sousse-babbhar", title: "Garage Dar Salma", address: "Rue de Paris, près de Bab Bhar", lat: 35.8291, lng: 10.6371, type: "garage", covered: true, price: 1500, peak: [1.3, 17, 21], days: MON_SAT, open: [480, 1260], desc: "Garage fermé, 1 voiture. 3 min à pied de Bab Bhar." },
  { host: 0, zone: "sousse-babbhar", title: "Cour Dar Salma (2e place)", address: "Rue de Paris", lat: 35.8293, lng: 10.6368, type: "courtyard", price: 1200, peak: [1.3, 17, 21], days: ALL, open: [420, 1380], desc: "Cour intérieure, portail. Idéal pour le souk." },
  { host: 1, zone: "sousse-babbhar", title: "Parking arrière Pharmacie Ennour", address: "Av. Habib Bourguiba", lat: 35.8301, lng: 10.6378, type: "lot", price: 2000, days: ALL, open: [1140, 1440], gardien: ["Am Hamadi", "+21600000109"], desc: "4 places libres après la fermeture (19h)." },
  { host: 1, zone: "sousse-babbhar", title: "Bureau – sous-sol après 18h", address: "Av. Léopold Senghor", lat: 35.8312, lng: 10.6352, type: "basement", covered: true, price: 1800, days: MON_SAT, open: [1080, 1440], desc: "Sous-sol d'immeuble de bureaux, libre le soir." },
  { host: 2, zone: "sousse-babbhar", title: "Allée Villa Jasmin", address: "Rue Ali Belhouane", lat: 35.8268, lng: 10.6359, type: "driveway", price: 1500, days: ALL, open: [360, 1320], desc: "Allée privée, sortie facile." },
  { host: 3, zone: "sousse-babbhar", title: "Arrière-cour Café El Bahr", address: "Près de la place Farhat Hached", lat: 35.8277, lng: 10.6392, type: "courtyard", price: 2500, peak: [1.5, 18, 23, SUMMER], days: ALL, open: [600, 1440], gardien: ["Slim", "+21600000110"], desc: "Cour derrière le café. Gardien sur place le soir." },
  { host: 4, zone: "sousse-babbhar", title: "Garage Rue de Constantine", address: "Rue de Constantine", lat: 35.8306, lng: 10.6334, type: "garage", covered: true, price: 1700, days: MON_SAT, open: [480, 1200], desc: "Garage simple, hauteur 2,1 m." },

  // Medina edges
  { host: 4, zone: "sousse-medina", title: "Cour près de Bab Jedid", address: "Bd. Yahia Ibn Omar", lat: 35.8236, lng: 10.6318, type: "courtyard", price: 1200, days: ALL, open: [420, 1260], desc: "Cour familiale, accès direct à la médina." },
  { host: 5, zone: "sousse-medina", title: "Atelier Sfar – place devant", address: "Rue de Tunis", lat: 35.8246, lng: 10.6301, type: "driveway", price: 1000, days: MON_SAT, open: [480, 1140], desc: "Place devant l'atelier, fermé le dimanche." },
  { host: 2, zone: "sousse-medina", title: "Parking privé Dar Jaziri", address: "Près du Ribat", lat: 35.8262, lng: 10.6322, type: "lot", price: 2000, peak: [1.3, 10, 18, SUMMER], days: ALL, open: [480, 1320], gardien: ["Am Béchir", "+21600000111"], desc: "5 places, gardien la journée. 4 min du Ribat." },
  { host: 6, zone: "sousse-medina", title: "Garage Haddad", address: "Bd. Abdelhamid Kadhi", lat: 35.8225, lng: 10.6338, type: "garage", covered: true, price: 1300, days: ALL, open: [360, 1380], desc: "Garage couvert, idéal pour la journée." },

  // Boujaafar / Corniche
  { host: 3, zone: "sousse-boujaafar", title: "Parking Hôtel Corniche (privé)", address: "Av. Hédi Chaker", lat: 35.8365, lng: 10.6296, type: "lot", price: 2500, peak: [1.5, 9, 20, SUMMER], days: ALL, open: [420, 1440], gardien: ["Réception", "+21600000112"], desc: "Places non utilisées par l'hôtel, plage à 2 min." },
  { host: 7, zone: "sousse-boujaafar", title: "Allée Villa Boujaafar", address: "Rue de la Corniche", lat: 35.8389, lng: 10.6271, type: "driveway", price: 1800, peak: [1.4, 10, 19, SUMMER], days: ALL, open: [480, 1260], desc: "Allée privée, plage Boujaafar à pied." },
  { host: 0, zone: "sousse-boujaafar", title: "Garage Résidence El Yasmine", address: "Av. Hédi Chaker", lat: 35.8346, lng: 10.6312, type: "basement", covered: true, price: 2000, days: ALL, open: [0, 1440], desc: "Sous-sol de résidence, accès 24h/24 avec code." },
  { host: 5, zone: "sousse-boujaafar", title: "Cour Dar Sfar", address: "Rue Abou Kacem Chebbi", lat: 35.8335, lng: 10.6332, type: "courtyard", price: 1500, days: ALL, open: [420, 1320], desc: "Cour avec portail, 2 places." },
  { host: 6, zone: "sousse-boujaafar", title: "Parking Clinique (soir)", address: "Av. du 14 Janvier", lat: 35.8402, lng: 10.6235, type: "lot", price: 1500, days: ALL, open: [1140, 1440], desc: "Parking du personnel, libre le soir." },

  // Khezama
  { host: 7, zone: "sousse-khezama", title: "Garage Khezama Est", address: "Rue Khezama Est", lat: 35.8535, lng: 10.6095, type: "garage", covered: true, price: 1000, days: ALL, open: [360, 1380], desc: "Garage simple, quartier calme." },
  { host: 1, zone: "sousse-khezama", title: "Parking Immeuble Les Pins", address: "Av. Yasser Arafat", lat: 35.8558, lng: 10.6052, type: "lot", price: 1200, days: MON_SAT, open: [480, 1200], desc: "Places visiteurs non utilisées en journée." },
  { host: 4, zone: "sousse-khezama", title: "Allée Villa Mejri", address: "Khezama Ouest", lat: 35.8512, lng: 10.6028, type: "driveway", price: 1000, days: ALL, open: [420, 1320], desc: "Allée privée, 1 voiture." },
  { host: 2, zone: "sousse-khezama", title: "Sous-sol Centre d'affaires", address: "Bd. 7 Novembre (Khezama)", lat: 35.8547, lng: 10.6116, type: "basement", covered: true, price: 1500, days: ALL, open: [1080, 1440], desc: "Sous-sol de bureaux, libre le soir et le week-end." },

  // Sahloul (hospital, university, clinics)
  { host: 6, zone: "sousse-sahloul", title: "Garage près de l'hôpital Sahloul", address: "Route de Ceinture", lat: 35.8362, lng: 10.5946, type: "garage", covered: true, price: 1200, days: ALL, open: [360, 1320], desc: "À 5 min à pied de l'hôpital. Pour visites et consultations." },
  { host: 3, zone: "sousse-sahloul", title: "Cour Résidence Sahloul 4", address: "Sahloul 4", lat: 35.8381, lng: 10.5908, type: "courtyard", price: 1000, days: ALL, open: [420, 1260], desc: "Cour de résidence, 3 places." },
  { host: 7, zone: "sousse-sahloul", title: "Parking Pharmacie de nuit", address: "Av. Ibn Khaldoun", lat: 35.8349, lng: 10.5972, type: "lot", price: 1500, days: ALL, open: [0, 1440], gardien: ["Am Fethi", "+21600000113"], desc: "Places réservées Plassa, ouvert 24h/24." },
  { host: 5, zone: "sousse-sahloul", title: "Allée Villa Bouzid", address: "Sahloul 3", lat: 35.8397, lng: 10.5951, type: "driveway", price: 1000, days: MON_SAT, open: [480, 1140], desc: "Allée privée, en semaine." },

  // Port El Kantaoui — summer peak
  { host: 3, zone: "sousse-kantaoui", title: "Parking Restaurant La Marina (privé)", address: "Près de la marina", lat: 35.8918, lng: 10.5951, type: "lot", price: 3000, peak: [1.5, 18, 24, SUMMER], days: ALL, open: [600, 1440], gardien: ["Nabil", "+21600000114"], desc: "8 places derrière le restaurant, marina à 1 min." },
  { host: 7, zone: "sousse-kantaoui", title: "Garage Villa Kantaoui", address: "Zone touristique", lat: 35.8887, lng: 10.5917, type: "garage", covered: true, price: 2500, peak: [1.4, 10, 22, SUMMER], days: ALL, open: [480, 1380], desc: "Garage de villa, location à l'heure en été." },
  { host: 6, zone: "sousse-kantaoui", title: "Allée Résidence Les Dunes", address: "Route touristique", lat: 35.8866, lng: 10.5962, type: "driveway", price: 2000, peak: [1.3, 10, 20, SUMMER], days: ALL, open: [480, 1320], desc: "Allée privée, accès plage." },
  { host: 0, zone: "sousse-kantaoui", title: "Cour Dar Kantaoui", address: "Hammam Sousse – Kantaoui", lat: 35.8902, lng: 10.5893, type: "courtyard", price: 2000, peak: [1.5, 18, 23, SUMMER], days: ALL, open: [600, 1440], desc: "Cour fermée, 2 places." },

  // The demo driver also rents out the driveway of the family house
  { host: -1, zone: "sousse-khezama", title: "Allée de Yassine", address: "Khezama Est, rue des Orangers", lat: 35.8522, lng: 10.6068, type: "driveway", price: 1000, days: ALL, open: [480, 1320], desc: "Allée devant la maison, libre quand je suis au travail.", methods: ["cash", "d17"] },
];

/** Relative demand weight per zone (searches per day) for the seeded city view. */
export const ZONE_DEMAND: Record<string, number> = {
  "sousse-babbhar": 34,
  "sousse-medina": 22,
  "sousse-boujaafar": 16,
  "sousse-khezama": 7,
  "sousse-sahloul": 14,
  "sousse-kantaoui": 9,
};

// ---------------------------------------------------------------------------
// Generated spots: deterministic, so every seed run produces the same city.

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stock photos in public/spots, by spot type (see docs/photo-credits.md). */
export const PHOTO_POOL: Record<SpotSeed["type"], string[]> = {
  garage: ["/spots/garage-1.jpg", "/spots/garage-2.jpg", "/spots/garage-3.jpg"],
  courtyard: ["/spots/courtyard-1.jpg", "/spots/courtyard-2.jpg", "/spots/courtyard-3.jpg", "/spots/courtyard-4.jpg"],
  driveway: ["/spots/driveway-1.jpg", "/spots/driveway-2.jpg", "/spots/driveway-3.jpg"],
  lot: ["/spots/lot-1.jpg", "/spots/lot-2.jpg", "/spots/lot-3.jpg"],
  basement: ["/spots/basement-1.jpg", "/spots/basement-2.jpg", "/spots/basement-3.jpg"],
};

/** Two photos per spot, rotating through the pool so neighbours differ. */
export function photosFor(type: SpotSeed["type"], i: number) {
  const pool = PHOTO_POOL[type];
  return [pool[i % pool.length], pool[(i + 1) % pool.length]];
}

const METHOD_SETS: [number, PaymentMethod[]][] = [
  [40, ["cash", "d17", "flouci", "card"]],
  [22, ["cash", "d17", "flouci"]],
  [14, ["cash"]],
  [12, ["d17", "flouci", "card"]],
  [12, ["cash", "card"]],
];

export function methodsFor(r: number): PaymentMethod[] {
  let x = r * 100;
  for (const [w, m] of METHOD_SETS) {
    if (x < w) return m;
    x -= w;
  }
  return METHOD_SETS[0][1];
}

const FAMILY = ["Ben Salah", "Gharbi", "Jlassi", "Mansour", "Karoui", "Bouaziz", "Chaabane", "Hamdi", "Ayari", "Feki", "Mabrouk", "Zouari", "Khelifi", "Sassi", "Mejri", "Dridi", "Hammami", "Laabidi"];
const RESIDENCES = ["Les Jasmins", "El Manar", "Les Palmiers", "Nour", "Azur", "Yasmina", "Les Orangers", "Les Oliviers", "El Bahr", "Essalem"];
const SHOPS = ["Boulangerie El Amel", "Pharmacie de garde", "Salle de sport Atlas", "Supérette du quartier", "Clinique dentaire", "Auto-école Errahma", "Agence de voyage", "Cabinet médical", "Librairie El Fikr", "Pâtisserie Dar Lella"];
const GARDIENS = ["Am Ali", "Am Moncef", "Am Habib", "Sami", "Lotfi", "Am Taoufik"];

const ZONE_GEN: Record<string, { n: number; price: number; streets: string[]; coast?: "east" | "north-east"; summer?: boolean }> = {
  "sousse-babbhar": { n: 10, price: 1800, streets: ["Rue de Paris", "Av. Habib Bourguiba", "Rue Ali Belhouane", "Rue de Constantine", "Av. Léopold Senghor", "Rue d'Angleterre"], coast: "east" },
  "sousse-medina": { n: 9, price: 1500, streets: ["Bd. Yahia Ibn Omar", "Rue de Tunis", "Bd. Abdelhamid Kadhi", "Près du Ribat", "Rue de la Kasbah"] },
  "sousse-boujaafar": { n: 9, price: 2000, streets: ["Av. Hédi Chaker", "Rue de la Corniche", "Rue Abou Kacem Chebbi", "Av. du 14 Janvier"], coast: "east", summer: true },
  "sousse-khezama": { n: 10, price: 1100, streets: ["Khezama Est", "Khezama Ouest", "Av. Yasser Arafat", "Rue des Orangers"] },
  "sousse-sahloul": { n: 10, price: 1200, streets: ["Sahloul 3", "Sahloul 4", "Route de Ceinture", "Av. Ibn Khaldoun", "Près de l'hôpital"] },
  "sousse-kantaoui": { n: 8, price: 2300, streets: ["Zone touristique", "Route touristique", "Près de la marina", "Hammam Sousse"], coast: "north-east", summer: true },
};

const DESC: Record<SpotSeed["type"], string[]> = {
  garage: ["Garage fermé, 1 voiture.", "Garage couvert avec rideau métallique.", "Garage simple, accès facile."],
  courtyard: ["Cour fermée avec portail.", "Cour intérieure, 2 places.", "Cour familiale, calme."],
  driveway: ["Allée privée, sortie directe sur la rue.", "Place devant la maison.", "Allée de villa, 1 voiture."],
  lot: ["Petit parking privé, plusieurs places.", "Places libres en dehors des heures d'ouverture.", "Parking clos, éclairé le soir."],
  basement: ["Sous-sol de résidence, accès avec code.", "Sous-sol couvert, hauteur 2 m.", "Sous-sol d'immeuble, ascenseur."],
};

function generateSpots(): SpotSeed[] {
  const r = rng(2026_11);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const out: SpotSeed[] = [];
  for (const z of ZONES) {
    const g = ZONE_GEN[z.id];
    if (!g) continue;
    for (let k = 0; k < g.n; k++) {
      const type = pick(["garage", "garage", "courtyard", "driveway", "lot", "basement"] as const);
      // keep pins on land: coastal neighbourhoods only spread inland (west / south-west)
      const dLat = g.coast === "north-east" ? -r() * 0.005 : (r() - 0.5) * 0.007;
      const dLng = g.coast ? -r() * 0.007 : (r() - 0.5) * 0.008;
      const fam = pick(FAMILY);
      const title =
        type === "garage"
          ? `Garage ${fam}`
          : type === "courtyard"
            ? `Cour Dar ${fam}`
            : type === "driveway"
              ? `Allée Villa ${fam}`
              : type === "lot"
                ? `Parking ${pick(SHOPS)}`
                : `Sous-sol Résidence ${pick(RESIDENCES)}`;
      const hoursRoll = r();
      const open: [number, number] =
        type === "basement" && hoursRoll < 0.5 ? [1080, 1440] : hoursRoll < 0.2 ? [0, 1440] : hoursRoll < 0.55 ? [420, 1320] : hoursRoll < 0.8 ? [480, 1200] : [360, 1380];
      const price = Math.max(800, g.price + Math.round((r() - 0.4) * 8) * 100 + (type === "garage" || type === "basement" ? 200 : 0));
      out.push({
        host: 1 + Math.floor(r() * (HOSTS.length - 1)),
        zone: z.id,
        title,
        address: pick(g.streets),
        lat: +(z.lat + dLat).toFixed(5),
        lng: +(z.lng + dLng).toFixed(5),
        type,
        covered: type === "garage" || type === "basement",
        price,
        peak: g.summer && r() < 0.5 ? [1.4, 10, 22, SUMMER] : r() < 0.25 ? [1.3, 17, 21] : undefined,
        days: r() < 0.75 ? ALL : MON_SAT,
        open,
        gardien: type === "lot" && r() < 0.6 ? [pick(GARDIENS), `+21600000${300 + out.length}`] : undefined,
        desc: pick(DESC[type]),
        methods: methodsFor(r()),
      });
    }
  }
  return out;
}

export const GENERATED_SPOTS = generateSpots();
/** Hand-placed spots first (their indices are stable for tests), then generated ones. */
export const ALL_SPOTS: SpotSeed[] = [...SPOTS, ...GENERATED_SPOTS];
