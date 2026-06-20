// Matches by controller naming convention

export class UserController {
  /**
   * Logs in the user.
   */
  login1(req: any, res: any) {}

  /**
   * Logs out the user.
   */
  logout1 = (req: any, res: any) => {}

  login2(req: any, res: any) {}
  logout2 = (req: any, res: any) => {}
  logout3 = function(req: any, res: any) {}

  // DECOY: Constructor is not a handler
  constructor() {}
}

// Total valid handlers here: 5
