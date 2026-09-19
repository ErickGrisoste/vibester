// Colunas que o contrato publico de perfil (userProfileSchema) realmente expoe.
//
// Selecionar explicitamente, em vez de deixar o Prisma trazer a linha inteira,
// tem dois motivos:
//   1. Nao trafegar colunas que a resposta descarta (ex.: shareCount, id).
//   2. Desacoplar o caminho de leitura de colunas que ele nao usa — uma coluna
//      nova no schema deixa de quebrar todas as queries de perfil.
export const profileSelect = {
    userID: true,
    name: true,
    username: true,
    avatarUrl: true,
    bio: true,
    followers: true,
    following: true,
    totalPosts: true,
    createdAt: true,
    updatedAt: true,
} as const;

export interface ProfileView {
    userID: string;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
    followers: number;
    following: number;
    totalPosts: number;
    createdAt: Date;
    updatedAt: Date;
}
