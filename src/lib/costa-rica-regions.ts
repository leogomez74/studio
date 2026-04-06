// Fuente: Wikipedia — Districts of Costa Rica (https://en.wikipedia.org/wiki/Districts_of_Costa_Rica)
// 7 provincias · 83 cantones · 492 distritos (División Territorial Administrativa oficial)

export type CostaRicaProvince = {
  name: string;
  cantons: {
    name: string;
    districts: string[];
  }[];
};

export const COSTA_RICA_PROVINCES: CostaRicaProvince[] = [
  {
    name: "San José",
    cantons: [
      { name: "San José", districts: ["Carmen","Merced","Hospital","Catedral","Zapote","San Francisco de Dos Ríos","Uruca","Mata Redonda","Pavas","Hatillo","San Sebastián"] },
      { name: "Escazú", districts: ["Escazú","San Antonio","San Rafael"] },
      { name: "Desamparados", districts: ["Desamparados","San Miguel","San Juan de Dios","San Rafael Arriba","San Antonio","Frailes","Patarrá","San Cristóbal","Rosario","Damas","San Rafael Abajo","Gravilias","Los Guido"] },
      { name: "Puriscal", districts: ["Santiago","Mercedes Sur","Barbacoas","Grifo Alto","San Rafael","Candelarita","Desamparaditos","San Antonio","Chires"] },
      { name: "Tarrazú", districts: ["San Marcos","San Lorenzo","San Carlos"] },
      { name: "Aserrí", districts: ["Aserrí","Tarbaca","Vuelta de Jorco","San Gabriel","Legua","Monterrey","Salitrillos"] },
      { name: "Mora", districts: ["Colón","Guayabo","Tabarcia","Piedras Negras","Picagres","Jaris","Quitirrisí"] },
      { name: "Goicoechea", districts: ["Guadalupe","San Francisco","Calle Blancos","Mata de Plátano","Ipís","Rancho Redondo","Purral"] },
      { name: "Santa Ana", districts: ["Santa Ana","Salitral","Pozos","Uruca","Piedades","Brasil"] },
      { name: "Alajuelita", districts: ["Alajuelita","San Josecito","San Antonio","Concepción","San Felipe"] },
      { name: "Vásquez de Coronado", districts: ["San Isidro","San Rafael","Dulce Nombre de Jesús","Patalillo","Cascajal"] },
      { name: "Acosta", districts: ["San Ignacio","Guaitil","Palmichal","Cangrejal","Sabanillas"] },
      { name: "Tibás", districts: ["San Juan","Cinco Esquinas","Anselmo Llorente","León XIII","Colima"] },
      { name: "Moravia", districts: ["San Vicente","San Jerónimo","La Trinidad"] },
      { name: "Montes de Oca", districts: ["San Pedro","Sabanilla","Mercedes","San Rafael"] },
      { name: "Turrubares", districts: ["San Pablo","San Pedro","San Juan de Mata","San Luis","Carara"] },
      { name: "Dota", districts: ["Santa María","Jardín","Copey"] },
      { name: "Curridabat", districts: ["Curridabat","Granadilla","Sánchez","Tirrases"] },
      { name: "Pérez Zeledón", districts: ["San Isidro de El General","El General","Daniel Flores","Rivas","San Pedro","Platanares","Pejibaye","Cajón","Barú","Río Nuevo","Páramo","La Amistad"] },
      { name: "León Cortés Castro", districts: ["San Pablo","San Andrés","Llano Bonito","San Isidro","Santa Cruz","San Antonio"] }
    ]
  },
  {
    name: "Alajuela",
    cantons: [
      { name: "Alajuela", districts: ["Alajuela","San José","Carrizal","San Antonio","Guácima","San Isidro","Sabanilla","San Rafael","Río Segundo","Desamparados","Turrúcares","Tambor","Garita","Sarapiquí"] },
      { name: "San Ramón", districts: ["San Ramón","Santiago","San Juan","Piedades Norte","Piedades Sur","San Rafael","San Isidro","Ángeles","Alfaro","Volio","Concepción","Zapotal","Peñas Blancas","San Lorenzo"] },
      { name: "Grecia", districts: ["Grecia","San Isidro","San José","San Roque","Tacares","Puente de Piedra","Bolívar"] },
      { name: "San Mateo", districts: ["San Mateo","Desmonte","Jesús María","Labrador"] },
      { name: "Atenas", districts: ["Atenas","Jesús","Mercedes","San Isidro","Concepción","San José","Santa Eulalia","Escobal"] },
      { name: "Naranjo", districts: ["Naranjo","San Miguel","San José","Cirrí Sur","San Jerónimo","San Juan","El Rosario","Palmitos"] },
      { name: "Palmares", districts: ["Palmares","Zaragoza","Buenos Aires","Santiago","Candelaria","Esquipulas","La Granja"] },
      { name: "Poás", districts: ["San Pedro","San Juan","San Rafael","Carrillos","Sabana Redonda"] },
      { name: "Orotina", districts: ["Orotina","El Mastate","Hacienda Vieja","Coyolar","La Ceiba"] },
      { name: "San Carlos", districts: ["Quesada","Florencia","Buenavista","Aguas Zarcas","Venecia","Pital","La Fortuna","La Tigra","La Palmera","Venado","Cutris","Monterrey","Pocosol"] },
      { name: "Zarcero", districts: ["Zarcero","Laguna","Tapesco","Guadalupe","Palmira","Zapote","Brisas"] },
      { name: "Sarchí", districts: ["Sarchí Norte","Sarchí Sur","Toro Amarillo","San Pedro","Rodríguez"] },
      { name: "Upala", districts: ["Upala","Aguas Claras","San José","Bijagua","Delicias","Dos Ríos","Yolillal","Canalete"] },
      { name: "Los Chiles", districts: ["Los Chiles","Caño Negro","El Amparo","San Jorge"] },
      { name: "Guatuso", districts: ["San Rafael","Buenavista","Cote","Katira"] },
      { name: "Río Cuarto", districts: ["Río Cuarto","Santa Rita","Santa Isabel"] }
    ]
  },
  {
    name: "Cartago",
    cantons: [
      { name: "Cartago", districts: ["Oriental","Occidental","Carmen","San Nicolás","Aguacaliente","Guadalupe","Corralillo","Tierra Blanca","Dulce Nombre","Llano Grande","Quebradilla"] },
      { name: "Paraíso", districts: ["Paraíso","Santiago","Orosi","Cachí","Llanos de Santa Lucía","Birrisito"] },
      { name: "La Unión", districts: ["Tres Ríos","San Diego","San Juan","San Rafael","Concepción","Dulce Nombre","San Ramón","Río Azul"] },
      { name: "Jiménez", districts: ["Juan Viñas","Tucurrique","Pejibaye","La Victoria"] },
      { name: "Turrialba", districts: ["Turrialba","La Suiza","Peralta","Santa Cruz","Santa Teresita","Pavones","Tuis","Tayutic","Santa Rosa","Tres Equis","La Isabel","Chirripó"] },
      { name: "Alvarado", districts: ["Pacayas","Cervantes","Capellades"] },
      { name: "Oreamuno", districts: ["San Rafael","Cot","Potrero Cerrado","Cipreses","Santa Rosa"] },
      { name: "El Guarco", districts: ["El Tejar","San Isidro","Tobosi","Patio de Agua"] }
    ]
  },
  {
    name: "Heredia",
    cantons: [
      { name: "Heredia", districts: ["Heredia","Mercedes","San Francisco","Ulloa","Varablanca"] },
      { name: "Barva", districts: ["Barva","San Pedro","San Pablo","San Roque","Santa Lucía","San José de la Montaña","Puente Salas"] },
      { name: "Santo Domingo", districts: ["Santo Domingo","San Vicente","San Miguel","Paracito","Santo Tomás","Santa Rosa","Tures","Pará"] },
      { name: "Santa Bárbara", districts: ["Santa Bárbara","San Pedro","San Juan","Jesús","Santo Domingo","Purabá"] },
      { name: "San Rafael", districts: ["San Rafael","San Josecito","Santiago","Ángeles","Concepción"] },
      { name: "San Isidro", districts: ["San Isidro","San José","Concepción","San Francisco"] },
      { name: "Belén", districts: ["San Antonio","La Ribera","La Asunción"] },
      { name: "Flores", districts: ["San Joaquín","Barrantes","Llorente"] },
      { name: "San Pablo", districts: ["San Pablo","Rincón de Sabanilla"] },
      { name: "Sarapiquí", districts: ["Puerto Viejo","La Virgen","Las Horquetas","Llanuras del Gaspar","Cureña"] }
    ]
  },
  {
    name: "Guanacaste",
    cantons: [
      { name: "Liberia", districts: ["Liberia","Cañas Dulces","Mayorga","Nacascolo","Curubandé"] },
      { name: "Nicoya", districts: ["Nicoya","Mansión","San Antonio","Quebrada Honda","Sámara","Nosara","Belén de Nosarita"] },
      { name: "Santa Cruz", districts: ["Santa Cruz","Bolsón","Veintisiete de Abril","Tempate","Cartagena","Cuajiniquil","Diriá","Cabo Velas","Tamarindo"] },
      { name: "Bagaces", districts: ["Bagaces","La Fortuna","Mogote","Río Naranjo"] },
      { name: "Carrillo", districts: ["Filadelfia","Palmira","Sardinal","Belén"] },
      { name: "Cañas", districts: ["Cañas","Palmira","San Miguel","Bebedero","Porozal"] },
      { name: "Abangares", districts: ["Las Juntas","Sierra","San Juan","Colorado"] },
      { name: "Tilarán", districts: ["Tilarán","Quebrada Grande","Tronadora","Santa Rosa","Líbano","Tierras Morenas","Arenal","Cabeceras"] },
      { name: "Nandayure", districts: ["Carmona","Santa Rita","Zapotal","San Pablo","Porvenir","Bejuco"] },
      { name: "La Cruz", districts: ["La Cruz","Santa Cecilia","La Garita","Santa Elena"] },
      { name: "Hojancha", districts: ["Hojancha","Monte Romo","Puerto Carrillo","Huacas","Matambú"] }
    ]
  },
  {
    name: "Puntarenas",
    cantons: [
      { name: "Puntarenas", districts: ["Puntarenas","Pitahaya","Chomes","Lepanto","Paquera","Manzanillo","Guacimal","Barranca","Isla del Coco","Cóbano","Chacarita","Chira","Acapulco","El Roble","Arancibia"] },
      { name: "Esparza", districts: ["Espíritu Santo","San Juan Grande","Macacona","San Rafael","San Jerónimo","Caldera"] },
      { name: "Buenos Aires", districts: ["Buenos Aires","Volcán","Potrero Grande","Boruca","Pilas","Colinas","Chánguena","Biolley","Brunka"] },
      { name: "Montes de Oro", districts: ["Miramar","La Unión","San Isidro"] },
      { name: "Osa", districts: ["Puerto Cortés","Palmar","Sierpe","Bahía Ballena","Piedras Blancas","Bahía Drake"] },
      { name: "Quepos", districts: ["Quepos","Savegre","Naranjito"] },
      { name: "Golfito", districts: ["Golfito","Guaycará","Pavón"] },
      { name: "Coto Brus", districts: ["San Vito","Sabalito","Aguabuena","Limoncito","Pittier","Gutiérrez Braun"] },
      { name: "Parrita", districts: ["Parrita"] },
      { name: "Corredores", districts: ["Corredor","La Cuesta","Canoas","Laurel"] },
      { name: "Garabito", districts: ["Jacó","Tárcoles"] },
      { name: "Monteverde", districts: ["Monteverde"] },
      { name: "Puerto Jiménez", districts: ["Puerto Jiménez"] }
    ]
  },
  {
    name: "Limón",
    cantons: [
      { name: "Limón", districts: ["Limón","Valle La Estrella","Río Blanco","Matama"] },
      { name: "Pococí", districts: ["Guápiles","Jiménez","Rita","Roxana","Cariari","Colorado","La Colonia"] },
      { name: "Siquirres", districts: ["Siquirres","Pacuarito","Florida","Germania","El Cairo","Alegría","Reventazón"] },
      { name: "Talamanca", districts: ["Bratsi","Sixaola","Cahuita","Telire"] },
      { name: "Matina", districts: ["Matina","Batán","Carrandí"] },
      { name: "Guácimo", districts: ["Guácimo","Mercedes","Pocora","Río Jiménez","Duacarí"] }
    ]
  }
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function findProvince(name: string): CostaRicaProvince | undefined {
  const n = norm(name);
  return COSTA_RICA_PROVINCES.find(p => norm(p.name) === n);
}

function findCanton(province: CostaRicaProvince, name: string) {
  const n = norm(name);
  return province.cantons.find(c => norm(c.name) === n);
}

export function getProvinceOptions(): { value: string; label: string }[] {
  return COSTA_RICA_PROVINCES.map(p => ({ value: p.name, label: p.name }));
}

export function getCantonOptions(provinceName: string): { value: string; label: string }[] {
  if (!provinceName) return [];
  const p = findProvince(provinceName);
  if (!p) return [];
  return p.cantons.map(c => ({ value: c.name, label: c.name }));
}

export function getDistrictOptions(provinceName: string, cantonName: string): { value: string; label: string }[] {
  if (!provinceName || !cantonName) return [];
  const p = findProvince(provinceName);
  if (!p) return [];
  const c = findCanton(p, cantonName);
  if (!c) return [];
  return c.districts.map(d => ({ value: d, label: d }));
}
