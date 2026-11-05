import { Alert, Button, Modal, Spinner } from 'react-bootstrap';

/** Modal de confirmación para acciones destructivas. */
export default function Confirmar({ show, titulo, mensaje, error, enviando, onConfirmar, onCerrar, textoBoton = 'Eliminar' }) {
  return (
    <Modal show={show} onHide={onCerrar} centered>
      <Modal.Header closeButton>
        <Modal.Title className="h5">{titulo}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {mensaje}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCerrar}>Cancelar</Button>
        <Button variant="danger" onClick={onConfirmar} disabled={enviando}>
          {enviando ? <Spinner size="sm" animation="border" /> : textoBoton}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
