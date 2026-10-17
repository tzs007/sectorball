export type Player = {
  readonly id: string;
  readonly nickname: string;
  readonly tokenHash: string;
  readonly createdAt: string;
};

export interface PlayerRepository {
  create(p: Player): Promise<void>;
  findByTokenHash(hash: string): Promise<Player | undefined>;
  findById(id: string): Promise<Player | undefined>;
}
