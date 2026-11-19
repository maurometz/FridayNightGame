// Códice dos Personagens (menu inicial, LORE seção 10): carta, resumo, curiosidades e frase lendária.
// O subtexto da despedida NÃO aparece aqui de forma direta. Fica só nas entrelinhas.

import type { CharacterId } from './characters';

export interface CodexEntry {
  readonly id: CharacterId;
  readonly name: string;
  readonly title: string;
  /** Mini-lore, 2 a 3 frases, tom de comédia. */
  readonly lore: string;
  readonly role: string;
  readonly weapon: string;
  readonly vehicle: string;
  readonly curiosities: readonly string[];
  /** Frase lendária (nível 10). */
  readonly legendary: string;
}

export const CODEX: Readonly<Record<CharacterId, CodexEntry>> = {
  felipe: {
    id: 'felipe',
    name: 'Felipe',
    title: 'O Bardo da Madrugada',
    lore: 'Músico caótico dono da casa onde tudo começa. Se tem silêncio, ele enche de barulho. Se tem barulho, ele aumenta.',
    role: 'Dano versátil: troca de instrumentos',
    weapon: 'Violão, bateria, flauta e kazoo',
    vehicle: 'Skate',
    curiosities: ['Trilha: música clássica.', 'Toca mais alto quando o assunto fica sério.', 'A geladeira dele é a porta de entrada da jornada.'],
    legendary: 'Vou tocar a última música do ano. Ou a primeira de outro jeito.',
  },
  mauro: {
    id: 'mauro',
    name: 'Mauro',
    title: 'O Guardião do Conhecimento Inútil',
    lore: 'Catalogou tudo, inclusive o que ninguém pediu. Carrega um tomo cheio de post-its e uma ficha de cada pessoa que já conheceu.',
    role: 'Escala tardia, dano à distância',
    weapon: 'Tomo arcano: Notas de Rodapé',
    vehicle: 'Armadura Mark III',
    curiosities: ['Trilha: emo.', 'Cuida da Galeria do Mauro.', 'Sabe o nome de quatro estrelas.'],
    legendary: 'Eu anoto tudo. Algumas coisas vou ter que lembrar sem papel.',
  },
  melissa: {
    id: 'melissa',
    name: 'Melissa',
    title: 'A Lâmina do Holofote',
    lore: 'Transforma qualquer sexta em espetáculo. Esgrima com um lightstick e marca Holofotes nas costas dos inimigos.',
    role: 'Mobilidade e crítico',
    weapon: 'Florete lightstick',
    vehicle: 'Citroën C3 Vermelho',
    curiosities: ['Trilha: K-pop synth-pop.', 'Ninguém encosta na chave do C3.', 'Sempre chega atrasada e sempre acha que está certa.'],
    legendary: 'Não quero planejar demais. Mas quero marcar a próxima.',
  },
  thaisa: {
    id: 'thaisa',
    name: 'Thaisa',
    title: 'A Valquíria do Rodízio',
    lore: 'Gaúcha, tanque do grupo. Golpeia com um violoncelo maior que ela e vive de comida. Para ela, amar é alimentar.',
    role: 'Tanque e controle de multidão',
    weapon: 'Violoncelo',
    vehicle: 'Carroça da Madrugada',
    curiosities: ['Trilha: milonga, chamamé e vanera.', 'Irmã da Tamires.', 'Filha do Marciano, o do caminhãozinho.'],
    legendary: 'Eu sempre soube guardar lugar pra alguém. Agora guardo um lugar em outra cidade.',
  },
  thayssa: {
    id: 'thayssa',
    name: 'Thayssa',
    title: 'A Dínamo Emocional',
    lore: 'Suporte emocional com uma aura visível: dourada na Euforia, violeta na Sobrecarga. Sente tudo no volume máximo.',
    role: 'Suporte e área',
    weapon: 'Microfone e megafone',
    vehicle: 'Cavalo Crioulo',
    curiosities: ['Trilha: disco-pop quente.', 'Sempre diz "no ano que vem eu vou...".', 'Aura capaz de quebrar transes.'],
    legendary: 'Ninguém precisa dizer adeus se ainda dá pra abraçar. Mesmo de longe, dá pra abraçar.',
  },
};

export const CODEX_ORDER: readonly CharacterId[] = ['felipe', 'mauro', 'melissa', 'thaisa', 'thayssa'];
