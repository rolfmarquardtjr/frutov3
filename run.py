from dotenv import load_dotenv
load_dotenv()

from app import create_app
import os

print("Iniciando a aplicação...")
app = create_app()
print("Aplicação iniciada.")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)