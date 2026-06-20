// Does not match service path, but matches CRUD naming conventions

export function createOrder(payload: any) {}
export function updateOrder(id: string, payload: any) {}
export const deleteOrder = (id: string) => {}
export const getOrder = (id: string) => {}
export const fetchOrder = function(id: string) {}

// DECOY: Does not match CRUD names
export function helperFunction() {}
export const somethingElse = () => {}

// Total valid handlers here: 5
