declare module "tsyringe" {
  export const container: any
  export function inject(token: any): any
  export function autoInjectable(): any
}

