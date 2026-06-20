// Matches by path: **/services/**

export function findUser1(id: string) {}
export function findUser2(id: string, includePosts: boolean) {}

export const activateUser1 = (id: string) => {};
export const activateUser2 = async (id: string) => {};
export const activateUser3 = function(id: string) {};

export default function defaultUserService(options: any) {}

export function promoteUser1() {}
export const promoteUser2 = () => {}

// DECOY: Type guard
export function isUser(obj: any): obj is { id: string } {
  return true;
}

// Total valid handlers here: 8
