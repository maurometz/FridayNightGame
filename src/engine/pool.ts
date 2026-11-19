export interface Poolable {
  /** Posição na lista de ativos. Gerenciado pelo Pool. */
  poolIndex: number;
}

/**
 * Object pooling: reaproveita objetos para não gerar lixo para o GC durante a partida.
 *
 * `release` usa remoção por troca (swap-remove), então a ordem de `active` muda.
 * Para liberar durante uma iteração, percorra de trás para frente.
 */
export class Pool<T extends Poolable> {
  readonly active: T[] = [];
  private readonly free: T[] = [];

  constructor(
    private readonly factory: () => T,
    readonly capacity: number,
  ) {}

  get size(): number {
    return this.active.length;
  }

  /** Devolve um objeto (a ser reinicializado pelo chamador) ou null se o limite foi atingido. */
  acquire(): T | null {
    if (this.active.length >= this.capacity) return null;
    const item = this.free.pop() ?? this.factory();
    item.poolIndex = this.active.length;
    this.active.push(item);
    return item;
  }

  release(item: T): void {
    // Proteção contra liberar duas vezes o mesmo objeto.
    if (this.active[item.poolIndex] !== item) return;
    const last = this.active.pop();
    if (last === undefined) return;
    if (last !== item) {
      this.active[item.poolIndex] = last;
      last.poolIndex = item.poolIndex;
    }
    this.free.push(item);
  }

  clear(): void {
    while (this.active.length > 0) {
      const item = this.active.pop();
      if (item) this.free.push(item);
    }
  }
}
