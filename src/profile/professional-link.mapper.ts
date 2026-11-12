import type { ProfessionalLinkModel } from './professional-link.model.js';

export function toProfessionalLinkModel(link: {
  label: string;
  url: string;
}): ProfessionalLinkModel {
  return {
    label: link.label,
    url: link.url,
  };
}
