// Invalida respostas assíncronas quando a tela, o personagem ou o projeto muda.
let revision = 0;

export const circleContext = (): number => revision;

export function changeCircleContext(): void {
  revision++;
}
