import { permanentRedirect } from 'next/navigation';

/** Ancienne adresse du Rami, conservée pour les liens déjà partagés. */
export default function Page() {
  permanentRedirect('/');
}
